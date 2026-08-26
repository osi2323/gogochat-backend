import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBan } from './entities/user-ban.entity';
import { FloodBan } from '../settings/entities/flood-ban.entity';
import { BanUserDto } from './dto/ban-user.dto';
import { DeviceBanUserDto } from './dto/device-ban-user.dto';
import { KickUserDto } from './dto/kick-user.dto';
import { User } from '../user/entities/user.entity';
import { ModerationGateway } from './moderation.gateway';
import { RoomsGateway } from '../rooms/rooms.gateway';
import { SecuritySettingsService } from '../settings/security-settings.service';
import { LoginHistoryService } from '../settings/login-history.service';
import { isProtectedActionBlocked } from '../common/utils/protection-access.util';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

const ACTION_NOT_ALLOWED_MESSAGE = 'Bu işlemi yapmaya hakkınız yok.';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(UserBan)
    private readonly userBanRepository: Repository<UserBan>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly moderationGateway: ModerationGateway,
    private readonly roomsGateway: RoomsGateway,
    @Optional()
    @Inject(forwardRef(() => SecuritySettingsService))
    private readonly securitySettingsService?: SecuritySettingsService,
    @Optional()
    @Inject(forwardRef(() => LoginHistoryService))
    private readonly loginHistoryService?: LoginHistoryService,
  ) {}

  private isRootUser(user: User | null | undefined): boolean {
    return String(user?.username || '').trim().toLocaleLowerCase('tr-TR') === 'root';
  }

  private isRootUsername(username?: string | null): boolean {
    return (
      String(username ?? '')
        .trim()
        .toLocaleLowerCase('tr-TR') === 'root'
    );
  }

  private assertTargetIsNotRoot(username?: string | null): void {
    if (!this.isRootUsername(username)) return;
    throw new ForbiddenException('Root kullanıcısına bu işlem uygulanamaz.');
  }

  private assertMicrophoneModerationPermission(
    user: User | null | undefined,
  ): void {
    if (this.isRootUser(user)) {
      return;
    }
    if (!hasPermissionForUser(user, PERMISSION_LABELS.MICROPHONE_MODERATION)) {
      throw new ForbiddenException('Mikrofon işlemleri için yetkiniz yok.');
    }
  }

  private assertCameraModerationPermission(
    user: User | null | undefined,
  ): void {
    if (this.isRootUser(user)) {
      return;
    }
    if (!hasPermissionForUser(user, PERMISSION_LABELS.CAMERA_MODERATION)) {
      throw new ForbiddenException('Kamera engelle yetkiniz yok.');
    }
  }

  async banUser(
    adminId: number,
    banUserDto: BanUserDto,
  ): Promise<{ ban: UserBan; targetUser: User | null }> {
    this.assertTargetIsNotRoot(banUserDto.username);

    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }

    const targetUser = await this.userRepository.findOne({
      where: { username: banUserDto.username },
      relations: ['role'],
    });

    if (targetUser && admin.id === targetUser.id) {
      throw new ForbiddenException('Kendinizi banlayamazsınız');
    }

    if (
      targetUser &&
      isProtectedActionBlocked({
        actorStarCount: admin.role.starCount,
        targetProtection: targetUser.protection,
        targetProtectedByStarCount: targetUser.protectedByStarCount,
      })
    ) {
      throw new ForbiddenException(
        'Bu kullanıcı korunuyor. Yalnızca koruyan yetkiliden daha üstün veya eş değer bir yetkili banlayabilir.',
      );
    }

    const adminStar = admin.role?.starCount ?? 0;
    const targetStar = targetUser?.role?.starCount ?? 0;

    if (targetUser && adminStar <= targetStar) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    if (targetUser) {
      const activeBan = await this.findActiveBanForUser(targetUser.id);
      if (activeBan) {
        throw new ForbiddenException('Kullanıcı zaten banlı');
      }
    }

    let expiresAt: Date | null = null;
    if (banUserDto.expiresAt) {
      expiresAt = new Date(banUserDto.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new BadRequestException('Geçerli bir tarih giriniz');
      }
    }

    const ban = this.userBanRepository.create({
      user: targetUser ?? undefined,
      userId: targetUser?.id ?? null,
      bannedBy: admin,
      bannedById: admin.id,
      reason: banUserDto.reason ?? null,
      expiresAt,
    });

    const saved = await this.userBanRepository.save(ban);

    this.moderationGateway.emitUserBanned({
      ...saved,
      username: targetUser?.username ?? banUserDto.username,
      bannedByUsername: admin.username,
      isGuest: !targetUser,
      actorStarCount: admin.role?.starCount ?? 0,
    } as any);

    return { ban: saved, targetUser };
  }

  async deviceBanUser(
    adminId: number,
    deviceBanUserDto: DeviceBanUserDto,
  ): Promise<{
    ipAddress: string;
    targetUser: User | null;
    affectedUsers: string[];
  }> {
    this.assertTargetIsNotRoot(deviceBanUserDto.username);

    if (!this.securitySettingsService || !this.loginHistoryService) {
      throw new BadRequestException('Cihaz banı servisi hazır değil');
    }

    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }

    const targetUser = await this.userRepository.findOne({
      where: { username: deviceBanUserDto.username },
      relations: ['role'],
    });

    const activeMember = this.roomsGateway.findActiveMemberForModeration(
      deviceBanUserDto.username,
    ) as
      | {
          username: string;
          isGuest: boolean;
          roleStarCount: number;
          ipAddress?: string | null;
          loginHistoryId?: number | null;
        }
      | null;

    const adminStar = admin.role?.starCount ?? 0;
    const targetStar = targetUser?.role?.starCount ?? activeMember?.roleStarCount ?? 0;

    if (targetUser && admin.id === targetUser.id) {
      throw new ForbiddenException('Kendinizi cihaz banına alamazsınız');
    }

    if (
      activeMember &&
      admin.username?.toLocaleLowerCase('tr-TR') ===
        activeMember.username?.toLocaleLowerCase('tr-TR')
    ) {
      throw new ForbiddenException('Kendinizi cihaz banına alamazsınız');
    }

    if (
      targetUser &&
      isProtectedActionBlocked({
        actorStarCount: admin.role.starCount,
        targetProtection: targetUser.protection,
        targetProtectedByStarCount: targetUser.protectedByStarCount,
      })
    ) {
      throw new ForbiddenException(
        'Bu kullanıcı korunuyor. Yalnızca koruyan yetkiliden daha üstün veya eş değer bir yetkili cihaz banı uygulayabilir.',
      );
    }

    if (adminStar <= targetStar) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    const ipAddress = await this.resolveDeviceBanIpAddress({
      username: deviceBanUserDto.username,
      targetUserId: targetUser?.id ?? null,
      activeIpAddress: activeMember?.ipAddress ?? null,
      loginHistoryId:
        typeof deviceBanUserDto.loginHistoryId === 'number'
          ? deviceBanUserDto.loginHistoryId
          : activeMember?.loginHistoryId ?? null,
    });

    await this.securitySettingsService.createOrRefreshFloodBan({
      ipAddress,
      reason: `${deviceBanUserDto.username} için manuel cihaz banı`,
      source: 'manual_device_ban',
      durationHours: null,
      metadata: {
        targetUsername: deviceBanUserDto.username,
        targetUserId: targetUser?.id ?? null,
        bannedById: admin.id,
        bannedByUsername: admin.username,
      },
    });

    const affectedUsers = this.roomsGateway.disconnectMembersByIpAddress(
      ipAddress,
      {
        bannedByUsername: admin.username,
        reason: 'Cihaz banı',
      },
    );

    return {
      ipAddress,
      targetUser,
      affectedUsers,
    };
  }

  private async resolveDeviceBanIpAddress(params: {
    username: string;
    targetUserId: number | null;
    activeIpAddress?: string | null;
    loginHistoryId?: number | null;
  }): Promise<string> {
    const activeIp = this.normalizeUsableIp(params.activeIpAddress);
    if (activeIp) {
      return activeIp;
    }

    if (params.loginHistoryId && this.loginHistoryService) {
      const record = await this.loginHistoryService.findById(
        params.loginHistoryId,
      );
      if (record) {
        const recordMatchesTarget =
          (params.targetUserId && record.userId === params.targetUserId) ||
          String(record.username || '')
            .trim()
            .toLocaleLowerCase('tr-TR') ===
            String(params.username || '')
              .trim()
              .toLocaleLowerCase('tr-TR');

        if (!recordMatchesTarget) {
          throw new BadRequestException('Giriş kaydı hedef kullanıcıya ait değil');
        }

        const recordIp = this.normalizeUsableIp(record.ipAddress);
        if (recordIp) {
          return recordIp;
        }
      }
    }

    const latestRecord = this.loginHistoryService
      ? await this.loginHistoryService.findLatestByUsername(params.username)
      : null;
    const latestIp = this.normalizeUsableIp(latestRecord?.ipAddress);
    if (latestIp) {
      return latestIp;
    }

    throw new BadRequestException('Kullanıcının IP bilgisi bulunamadı');
  }

  private normalizeUsableIp(ipAddress?: string | null): string | null {
    const normalizedIp = String(ipAddress ?? '').trim();
    if (!normalizedIp || normalizedIp.toLowerCase() === 'unknown') {
      return null;
    }
    return normalizedIp;
  }

  async kickUser(adminId: number, kickUserDto: KickUserDto): Promise<void> {
    this.assertTargetIsNotRoot(kickUserDto.username);

    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }

    const targetUser = await this.userRepository.findOne({
      where: { username: kickUserDto.username },
      relations: ['role'],
    });

    // Not: Hedef kullanıcı DB'de olmayabilir (misafir olabilir), bu yüzden targetUser null olabilir.
    // Ancak veritabanında varsa yıldız kontrolü yapalım.
    if (targetUser) {
      if (admin.id === targetUser.id) {
        throw new ForbiddenException('Kendinizi sistemden atamazsınız');
      }

      if (
        isProtectedActionBlocked({
          actorStarCount: admin.role.starCount,
          targetProtection: targetUser.protection,
          targetProtectedByStarCount: targetUser.protectedByStarCount,
        })
      ) {
        throw new ForbiddenException(
          'Bu kullanıcı korunuyor. Yalnızca koruyan yetkiliden daha üstün veya eş değer bir yetkili sistemden atabilir.',
        );
      }

      const adminStar = admin.role?.starCount ?? 0;
      const targetStar = targetUser.role?.starCount ?? 0;

      if (adminStar <= targetStar) {
        throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
      }
    }

    // Soket üzerinden atılma komutu gönder
    this.moderationGateway.emitUserKicked({
      username: kickUserDto.username,
      kickedByUsername: admin.username,
      reason: kickUserDto.reason,
      actorStarCount: admin.role?.starCount ?? 0,
    });
  }

  async findActiveBanForUser(userId: number): Promise<UserBan | null> {
    return this.userBanRepository
      .createQueryBuilder('ban')
      .where('ban.userId = :userId', { userId })
      .orderBy('ban.createdAt', 'DESC')
      .getOne();
  }

  async ensureUserNotBanned(userId: number): Promise<void> {
    const activeBan = await this.findActiveBanForUser(userId);
    if (activeBan) {
      throw new ForbiddenException(
        `Kullanıcı banlı${activeBan.reason ? `: ${activeBan.reason}` : ''}`,
      );
    }
  }

  async getBannedUsers(): Promise<UserBan[]> {
    return this.userBanRepository
      .createQueryBuilder('ban')
      .leftJoinAndSelect('ban.user', 'user')
      .leftJoinAndSelect('ban.bannedBy', 'bannedBy')
      .leftJoinAndSelect('bannedBy.role', 'bannedByRole')
      .orderBy('ban.createdAt', 'DESC')
      .getMany();
  }

  async getActiveIpBans(): Promise<FloodBan[]> {
    if (!this.securitySettingsService) {
      return [];
    }

    const response = await this.securitySettingsService.getActiveFloodBans();
    return (response.items ?? []).map(
      (item) =>
        ({
          id: item.id,
          ipAddress: item.ipAddress,
          reason: item.reason,
          source: item.source,
          expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
          createdAt: item.createdAt ? new Date(item.createdAt) : null,
          metadata: item.metadata ?? null,
        }) as FloodBan,
    );
  }

  async unbanIp(adminId: number, banId: number): Promise<FloodBan> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }

    if (!this.securitySettingsService) {
      throw new BadRequestException('IP ban servisi hazır değil');
    }

    return this.securitySettingsService.clearFloodBanById(banId);
  }

  async getAllBans(): Promise<UserBan[]> {
    return this.userBanRepository
      .createQueryBuilder('ban')
      .leftJoinAndSelect('ban.user', 'user')
      .leftJoinAndSelect('ban.bannedBy', 'bannedBy')
      .leftJoinAndSelect('bannedBy.role', 'bannedByRole')
      .orderBy('ban.createdAt', 'DESC')
      .getMany();
  }

  async unbanUser(adminId: number, banId: number): Promise<void> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }

    const ban = await this.userBanRepository.findOne({
      where: { id: banId },
      relations: ['user', 'user.role'],
    });

    if (!ban) {
      throw new BadRequestException('Ban kaydı bulunamadı');
    }

    if (
      ban.user &&
      isProtectedActionBlocked({
        actorStarCount: admin.role.starCount,
        targetProtection: ban.user.protection,
        targetProtectedByStarCount: ban.user.protectedByStarCount,
      })
    ) {
      throw new ForbiddenException(
        'Bu kullanıcı korunuyor. Yalnızca koruyan yetkiliden daha üstün veya eş değer bir yetkili banını kaldırabilir.',
      );
    }

    const adminStar = admin.role?.starCount ?? 0;
    const bannedUserStar = ban.user?.role?.starCount ?? 0;

    if (adminStar <= bannedUserStar) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    await this.userBanRepository.delete(banId);
  }

  async clearBannedUsers(
    adminId: number,
  ): Promise<{ clearedCount: number; skippedCount: number }> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }

    const adminStar = admin.role?.starCount ?? 0;
    const isRoot = this.isRootUser(admin);
    const bans = await this.userBanRepository.find({
      relations: ['user', 'user.role'],
    });
    const deletableIds: number[] = [];

    for (const ban of bans) {
      const bannedUserStar = ban.user?.role?.starCount ?? 0;
      const blockedByProtection =
        ban.user &&
        isProtectedActionBlocked({
          actorStarCount: adminStar,
          targetProtection: ban.user.protection,
          targetProtectedByStarCount: ban.user.protectedByStarCount,
        });
      const blockedByRank = ban.user && adminStar <= bannedUserStar;

      if (!isRoot && (blockedByProtection || blockedByRank)) {
        continue;
      }
      deletableIds.push(ban.id);
    }

    if (deletableIds.length) {
      await this.userBanRepository.delete(deletableIds);
    }

    return {
      clearedCount: deletableIds.length,
      skippedCount: bans.length - deletableIds.length,
    };
  }

  async clearRoomMutes(
    adminId: number,
    room: string,
  ): Promise<{ clearedCount: number; skippedCount: number; room: string }> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }
    this.assertMicrophoneModerationPermission(admin);

    const normalizedRoom = String(room ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedRoom) {
      throw new BadRequestException('Oda bilgisi zorunludur');
    }

    const result = this.roomsGateway.clearRoomMuteStates(
      normalizedRoom,
      admin.role.starCount ?? 0,
      admin.username,
      this.isRootUser(admin),
    );

    return {
      ...result,
      room: normalizedRoom,
    };
  }

  async clearGlobalMutes(
    adminId: number,
  ): Promise<{ clearedCount: number; skippedCount: number }> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }
    this.assertMicrophoneModerationPermission(admin);

    const adminStar = admin.role?.starCount ?? 0;
    const isRoot = this.isRootUser(admin);
    const mutedUsers = await this.userRepository.find({
      where: { globalMuted: true },
      relations: ['role'],
    });
    const mutedUsernames = mutedUsers.map((user) => user.username);
    const clearedUsers: User[] = [];
    let skippedCount = 0;

    for (const mutedUser of mutedUsers) {
      const targetStar = mutedUser.role?.starCount ?? 0;
      const blockedByProtection = isProtectedActionBlocked({
        actorStarCount: adminStar,
        isRoot,
        targetProtection: mutedUser.protection,
        targetProtectedByStarCount: mutedUser.protectedByStarCount,
      });
      const blockedByRank = adminStar <= targetStar;
      const blockedByMuteOwner =
        adminStar < (mutedUser.globalMutedByStarCount ?? 0);

      if (
        !isRoot &&
        (blockedByProtection || blockedByRank || blockedByMuteOwner)
      ) {
        skippedCount += 1;
        continue;
      }

      mutedUser.globalMuted = false;
      mutedUser.globalMutedByStarCount = 0;
      clearedUsers.push(mutedUser);
    }

    if (clearedUsers.length) {
      await this.userRepository.save(clearedUsers);
      for (const user of clearedUsers) {
        this.roomsGateway.setGlobalMuteState(
          user.username,
          false,
          0,
          admin.username,
        );
      }
    }

    const activeResult = this.roomsGateway.clearGlobalMuteStates(
      adminStar,
      admin.username,
      isRoot,
      mutedUsernames,
    );

    return {
      clearedCount: clearedUsers.length + activeResult.clearedCount,
      skippedCount: skippedCount + activeResult.skippedCount,
    };
  }

  async toggleMicBan(
    adminId: number,
    targetUsername: string,
  ): Promise<{
    micBanned: boolean;
    targetUserId: number | null;
    targetUsername: string;
    isGuest: boolean;
  }> {
    this.assertTargetIsNotRoot(targetUsername);

    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }
    this.assertMicrophoneModerationPermission(admin);

    const adminStar = admin.role.starCount;
    const targetUser = await this.userRepository.findOne({
      where: { username: targetUsername },
      relations: ['role'],
    });

    if (targetUser) {
      if (admin.id === targetUser.id) {
        throw new ForbiddenException('Kendi mikrofonunuzu yasaklayamazsınız');
      }

      const targetStar = targetUser.role?.starCount ?? 0;

      if (
        isProtectedActionBlocked({
          actorStarCount: adminStar,
          targetProtection: targetUser.protection,
          targetProtectedByStarCount: targetUser.protectedByStarCount,
        })
      ) {
        throw new ForbiddenException(
          'Bu kullanıcı korunuyor. Yalnızca koruyan yetkiliden daha üstün veya eş değer bir yetkili mikrofonu yasaklayabilir.',
        );
      }

      // Role star count check
      if (adminStar <= targetStar) {
        throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
      }

      // If unbanning, check if current admin has enough stars to lift the ban
      if (targetUser.micBanned && adminStar < targetUser.micBannedByStarCount) {
        throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
      }

      targetUser.micBanned = !targetUser.micBanned;
      targetUser.micBannedByStarCount = targetUser.micBanned ? adminStar : 0;

      const savedUser = await this.userRepository.save(targetUser);

      // Apply mic ban/unban to active rooms
      this.roomsGateway.setMicBanState(
        savedUser.username,
        savedUser.micBanned,
        savedUser.micBannedByStarCount ?? 0,
      );

      // Emit event
      this.moderationGateway.emitMicBanToggled({
        userId: savedUser.id,
        username: savedUser.username,
        micBanned: savedUser.micBanned,
        bannedByUsername: admin.username,
        actorStarCount: adminStar,
      });

      return {
        micBanned: savedUser.micBanned,
        targetUserId: savedUser.id,
        targetUsername: savedUser.username,
        isGuest: false,
      };
    }

    const targetMember =
      this.roomsGateway.findActiveMemberForModeration(targetUsername);

    if (!targetMember) {
      throw new BadRequestException('Hedef kullanıcı bulunamadı');
    }

    if (
      admin.username?.toLowerCase() === targetMember.username?.toLowerCase()
    ) {
      throw new ForbiddenException('Kendi mikrofonunuzu yasaklayamazsınız');
    }

    if (adminStar <= targetMember.roleStarCount) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    if (
      targetMember.micBanned &&
      adminStar < targetMember.micBannedByStarCount
    ) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    const micBanned = !targetMember.micBanned;
    const updated = this.roomsGateway.setMicBanState(
      targetMember.username,
      micBanned,
      micBanned ? adminStar : 0,
    );

    if (!updated) {
      throw new BadRequestException('Hedef kullanıcı bulunamadı');
    }

    this.moderationGateway.emitMicBanToggled({
      userId: null,
      username: targetMember.username,
      micBanned,
      bannedByUsername: admin.username,
      actorStarCount: adminStar,
    });

    return {
      micBanned,
      targetUserId: null,
      targetUsername: targetMember.username,
      isGuest: targetMember.isGuest,
    };
  }

  async toggleCameraBan(
    adminId: number,
    targetUsername: string,
  ): Promise<{
    cameraBanned: boolean;
    targetUserId: number | null;
    targetUsername: string;
    isGuest: boolean;
  }> {
    this.assertTargetIsNotRoot(targetUsername);

    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }
    this.assertCameraModerationPermission(admin);

    const adminStar = admin.role.starCount;
    const targetUser = await this.userRepository.findOne({
      where: { username: targetUsername },
      relations: ['role'],
    });

    if (targetUser) {
      if (admin.id === targetUser.id) {
        throw new ForbiddenException('Kendi kameranızı yasaklayamazsınız');
      }

      const targetStar = targetUser.role?.starCount ?? 0;

      if (
        isProtectedActionBlocked({
          actorStarCount: adminStar,
          targetProtection: targetUser.protection,
          targetProtectedByStarCount: targetUser.protectedByStarCount,
        })
      ) {
        throw new ForbiddenException(
          'Bu kullanıcı korunuyor. Yalnızca koruyan yetkiliden daha üstün veya eş değer bir yetkili kamerayı yasaklayabilir.',
        );
      }

      if (adminStar <= targetStar) {
        throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
      }

      if (
        targetUser.cameraBanned &&
        adminStar < (targetUser.cameraBannedByStarCount ?? 0)
      ) {
        throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
      }

      targetUser.cameraBanned = !targetUser.cameraBanned;
      targetUser.cameraBannedByStarCount = targetUser.cameraBanned
        ? adminStar
        : 0;

      const savedUser = await this.userRepository.save(targetUser);

      this.roomsGateway.setCameraBanState(
        savedUser.username,
        savedUser.cameraBanned,
        savedUser.cameraBannedByStarCount ?? 0,
      );

      this.moderationGateway.emitCameraBanToggled({
        userId: savedUser.id,
        username: savedUser.username,
        cameraBanned: savedUser.cameraBanned,
        bannedByUsername: admin.username,
        actorStarCount: adminStar,
      });

      return {
        cameraBanned: savedUser.cameraBanned,
        targetUserId: savedUser.id,
        targetUsername: savedUser.username,
        isGuest: false,
      };
    }

    const targetMember =
      this.roomsGateway.findActiveMemberForModeration(targetUsername);

    if (!targetMember) {
      throw new BadRequestException('Hedef kullanıcı bulunamadı');
    }

    if (
      admin.username?.toLowerCase() === targetMember.username?.toLowerCase()
    ) {
      throw new ForbiddenException('Kendi kameranızı yasaklayamazsınız');
    }

    if (adminStar <= targetMember.roleStarCount) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    if (
      targetMember.cameraBanned &&
      adminStar < targetMember.cameraBannedByStarCount
    ) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    const cameraBanned = !targetMember.cameraBanned;
    const updated = this.roomsGateway.setCameraBanState(
      targetMember.username,
      cameraBanned,
      cameraBanned ? adminStar : 0,
    );

    if (!updated) {
      throw new BadRequestException('Hedef kullanıcı bulunamadı');
    }

    this.moderationGateway.emitCameraBanToggled({
      userId: null,
      username: targetMember.username,
      cameraBanned,
      bannedByUsername: admin.username,
      actorStarCount: adminStar,
    });

    return {
      cameraBanned,
      targetUserId: null,
      targetUsername: targetMember.username,
      isGuest: targetMember.isGuest,
    };
  }

  async toggleRoomMute(
    adminId: number,
    targetUsername: string,
    room: string,
  ): Promise<{
    roomMuted: boolean;
    room: string;
    targetUserId: number | null;
    targetUsername: string;
  }> {
    this.assertTargetIsNotRoot(targetUsername);

    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }
    this.assertMicrophoneModerationPermission(admin);

    const normalizedRoom = String(room ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedRoom) {
      throw new BadRequestException('Oda bilgisi zorunludur');
    }

    const adminStar = admin.role.starCount;
    const targetUser = await this.userRepository.findOne({
      where: { username: targetUsername },
      relations: ['role'],
    });

    if (targetUser) {
      if (admin.id === targetUser.id) {
        throw new ForbiddenException('Kendinizi odada susturamazsınız');
      }

      if (
        isProtectedActionBlocked({
          actorStarCount: adminStar,
          targetProtection: targetUser.protection,
          targetProtectedByStarCount: targetUser.protectedByStarCount,
        })
      ) {
        throw new ForbiddenException(
          'Bu kullanıcı korunuyor. Yalnızca koruyan yetkiliden daha üstün veya eş değer bir yetkili odada susturabilir.',
        );
      }

      const targetStar = targetUser.role?.starCount ?? 0;
      if (adminStar <= targetStar) {
        throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
      }
    }

    const targetMember = this.roomsGateway.findActiveMemberForModeration(
      targetUsername,
      normalizedRoom,
    );

    if (!targetMember) {
      throw new BadRequestException(
        'Hedef kullanıcı belirtilen odada bulunamadı',
      );
    }

    if (
      admin.username?.toLowerCase() === targetMember.username?.toLowerCase()
    ) {
      throw new ForbiddenException('Kendinizi odada susturamazsınız');
    }

    if (adminStar <= targetMember.roleStarCount) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    if (
      targetMember.roomMuted &&
      adminStar < (targetMember.roomMutedByStarCount ?? 0)
    ) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    const roomMuted = !targetMember.roomMuted;
    const updated = this.roomsGateway.setRoomMuteState(
      targetMember.username,
      normalizedRoom,
      roomMuted,
      roomMuted ? adminStar : 0,
      admin.username,
    );

    if (!updated) {
      throw new BadRequestException(
        'Hedef kullanıcı belirtilen odada bulunamadı',
      );
    }

    return {
      roomMuted,
      room: normalizedRoom,
      targetUserId: targetUser?.id ?? null,
      targetUsername: targetMember.username,
    };
  }

  async toggleGlobalMute(
    adminId: number,
    targetUsername: string,
  ): Promise<{
    globalMuted: boolean;
    targetUserId: number | null;
    targetUsername: string;
    isGuest: boolean;
  }> {
    this.assertTargetIsNotRoot(targetUsername);

    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }
    this.assertMicrophoneModerationPermission(admin);

    const adminStar = admin.role.starCount;
    const targetUser = await this.userRepository.findOne({
      where: { username: targetUsername },
      relations: ['role'],
    });

    if (targetUser) {
      if (admin.id === targetUser.id) {
        throw new ForbiddenException('Kendinizi tüm odalarda susturamazsınız');
      }

      if (
        isProtectedActionBlocked({
          actorStarCount: adminStar,
          targetProtection: targetUser.protection,
          targetProtectedByStarCount: targetUser.protectedByStarCount,
        })
      ) {
        throw new ForbiddenException(
          'Bu kullanıcı korunuyor. Yalnızca koruyan yetkiliden daha üstün veya eş değer bir yetkili tüm odalarda susturabilir.',
        );
      }

      const targetStar = targetUser.role?.starCount ?? 0;
      if (adminStar <= targetStar) {
        throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
      }

      if (
        targetUser.globalMuted &&
        adminStar < (targetUser.globalMutedByStarCount ?? 0)
      ) {
        throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
      }

      targetUser.globalMuted = !targetUser.globalMuted;
      targetUser.globalMutedByStarCount = targetUser.globalMuted
        ? adminStar
        : 0;

      const savedUser = await this.userRepository.save(targetUser);

      this.roomsGateway.setGlobalMuteState(
        savedUser.username,
        savedUser.globalMuted,
        savedUser.globalMuted ? (savedUser.globalMutedByStarCount ?? 0) : 0,
        admin.username,
      );
      this.moderationGateway.emitMuteStateChanged({
        username: savedUser.username,
        scope: 'global',
        globalMuted: savedUser.globalMuted,
        mutedByUsername: admin.username,
      });

      return {
        globalMuted: savedUser.globalMuted,
        targetUserId: savedUser.id,
        targetUsername: savedUser.username,
        isGuest: false,
      };
    }

    const targetMember =
      this.roomsGateway.findActiveMemberForModeration(targetUsername);

    if (!targetMember) {
      throw new BadRequestException('Hedef kullanıcı bulunamadı');
    }

    if (
      admin.username?.toLowerCase() === targetMember.username?.toLowerCase()
    ) {
      throw new ForbiddenException('Kendinizi tüm odalarda susturamazsınız');
    }

    if (adminStar <= targetMember.roleStarCount) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    if (
      targetMember.globalMuted &&
      adminStar < (targetMember.globalMutedByStarCount ?? 0)
    ) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    const globalMuted = !targetMember.globalMuted;
    const updated = this.roomsGateway.setGlobalMuteState(
      targetMember.username,
      globalMuted,
      globalMuted ? adminStar : 0,
      admin.username,
    );

    if (!updated) {
      throw new BadRequestException('Hedef kullanıcı bulunamadı');
    }

    this.moderationGateway.emitMuteStateChanged({
      username: targetMember.username,
      scope: 'global',
      globalMuted,
      mutedByUsername: admin.username,
    });

    return {
      globalMuted,
      targetUserId: null,
      targetUsername: targetMember.username,
      isGuest: targetMember.isGuest,
    };
  }
}
