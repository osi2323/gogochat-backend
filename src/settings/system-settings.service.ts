import { randomUUID } from 'crypto';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { promises as fs, statSync } from 'fs';
import * as path from 'path';
import {
  AccessLevel,
  LoginDesignType,
  SiteLanguage,
  SystemSettings,
} from './entities/system-settings.entity';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import { SystemSettingsResponseDto } from './dto/system-settings-response.dto';
import { FirstMessageDelayResponseDto } from './dto/first-message-delay-response.dto';
import { MaintenanceModeResponseDto } from './dto/maintenance-mode-response.dto';
import { ChatPermissionsResponseDto } from './dto/chat-permissions-response.dto';
import { CommunicationPermissionsResponseDto } from './dto/communication-permissions-response.dto';
import { GuestWaitResponseDto } from './dto/guest-wait-response.dto';
import { User } from '../user/entities/user.entity';
import { Gender } from '../common/enums/gender.enum';
import { LoginHistory } from './entities/login-history.entity';
import { AdminAction } from '../admin-actions/entities/admin-action.entity';
import { Role } from '../role/entities/role.entity';
import { UserBan } from '../moderation/entities/user-ban.entity';
import { Message } from '../messages/entities/message.entity';
import { ModerationGateway } from '../moderation/moderation.gateway';
import { RoomsGateway } from '../rooms/rooms.gateway';
import {
  WebConsoleStatsListItemDto,
  WebConsoleStatsResponseDto,
} from './dto/web-console-stats-response.dto';
import {
  WebConsoleAnimationItemDto,
  WebConsoleAnimationsResponseDto,
} from './dto/web-console-animations-response.dto';
import { PERMISSION_LABELS } from '../common/utils/permission.util';

@Injectable()
export class SystemSettingsService {
  private static readonly MAX_WEB_CONSOLE_ANIMATIONS = 500;
  private static readonly ALLOWED_ANIMATION_EXTENSIONS = new Set([
    '.gif',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
  ]);
  private static readonly SYSTEM_MESSAGE_COOLDOWN_MS = 5 * 60 * 1000;
  private lastSystemMessageSentAt: number | null = null;

  constructor(
    @InjectRepository(SystemSettings)
    private readonly systemSettingsRepository: Repository<SystemSettings>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepository: Repository<LoginHistory>,
    @InjectRepository(AdminAction)
    private readonly adminActionRepository: Repository<AdminAction>,
    @InjectRepository(UserBan)
    private readonly userBanRepository: Repository<UserBan>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly moderationGateway: ModerationGateway,
    @Inject(forwardRef(() => RoomsGateway))
    private readonly roomsGateway: RoomsGateway,
  ) {}

  async getSettings(): Promise<SystemSettingsResponseDto> {
    const settings = await this.getOrCreate();
    return this.toResponse(settings);
  }

  async getHeaderRosterCandidates(): Promise<Array<{
    id: number;
    username: string;
    icon: string | null;
    gender: string | null;
    roleName: string | null;
    starCount: number;
    starColor: string | null;
  }>> {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.deletedAt IS NULL')
      .andWhere('(LOWER(user.username) = :root OR role.starCount >= :minStars)', {
        root: 'root',
        minStars: 1,
      })
      .orderBy('role.starCount', 'DESC')
      .addOrderBy('user.username', 'ASC')
      .getMany();

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      icon: user.icon ?? null,
      gender: user.gender ?? null,
      roleName: user.role?.name ?? null,
      starCount: Number(user.role?.starCount ?? 0),
      starColor: user.role?.starColor ?? null,
    }));
  }

  async getPublicHeaderRoster(): Promise<{
    chatHeaderLogo: string | null;
    siteName: string | null;
    mobileHeaderColor: string;
    mobileFooterColor: string;
    chatSiteTheme: string;
    siteOwners: Array<{ id: number; username: string; icon: string | null; gender: string | null; roleName: string | null; starCount: number; starColor: string | null }>;
    managers: Array<{ id: number; username: string; icon: string | null; gender: string | null; roleName: string | null; starCount: number; starColor: string | null }>;
  }> {
    const settings = await this.getOrCreate();
    const ownerNames = Array.isArray(settings.siteOwnerUsernames) ? settings.siteOwnerUsernames : [];
    const managerNames = Array.isArray(settings.managerUsernames) ? settings.managerUsernames : [];
    const allNames = [...new Set([...ownerNames, ...managerNames].map((item) => item.trim()).filter(Boolean))];

    if (allNames.length === 0) {
      return {
        chatHeaderLogo: settings.chatHeaderLogo ?? null,
        siteName: settings.siteName ?? null,
        mobileHeaderColor: settings.mobileHeaderColor || '#0057B8',
        mobileFooterColor: settings.mobileFooterColor || '#0057B8',
        chatSiteTheme: ['dark', 'light', 'glass', 'neon'].includes(settings.chatSiteTheme) ? settings.chatSiteTheme : 'dark',
        siteOwners: [],
        managers: [],
      };
    }

    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.deletedAt IS NULL')
      .andWhere('LOWER(user.username) IN (:...usernames)', {
        usernames: allNames.map((item) => item.toLocaleLowerCase('tr-TR')),
      })
      .getMany();

    const byName = new Map(
      users.map((user) => [user.username.toLocaleLowerCase('tr-TR'), user]),
    );
    const mapNames = (names: string[]) =>
      names
        .map((name) => byName.get(name.toLocaleLowerCase('tr-TR')))
        .filter((user): user is User => Boolean(user))
        .map((user) => ({
          id: user.id,
          username: user.username,
          icon: user.icon ?? null,
          gender: user.gender ?? null,
          roleName: user.role?.name ?? null,
          starCount: Number(user.role?.starCount ?? 0),
          starColor: user.role?.starColor ?? null,
        }));

    return {
      chatHeaderLogo: settings.chatHeaderLogo ?? null,
      siteName: settings.siteName ?? null,
      mobileHeaderColor: settings.mobileHeaderColor || '#0057B8',
      mobileFooterColor: settings.mobileFooterColor || '#0057B8',
      chatSiteTheme: ['dark', 'light', 'glass', 'neon'].includes(settings.chatSiteTheme) ? settings.chatSiteTheme : 'dark',
      siteOwners: mapNames(ownerNames),
      managers: mapNames(managerNames),
    };
  }

  async getFirstMessageDelay(): Promise<FirstMessageDelayResponseDto> {
    const settings = await this.getOrCreate();
    return {
      firstMessageDelayEnabled: settings.firstMessageDelayEnabled,
      firstMessageDelaySeconds:
        this.normalizeFirstMessageDelaySeconds(settings),
      firstMessageDelayUpdatedAt:
        settings.firstMessageDelayUpdatedAt?.toISOString() ?? null,
    };
  }

  async getMaintenanceMode(): Promise<MaintenanceModeResponseDto> {
    const settings = await this.getOrCreate();
    return {
      maintenanceMode: settings.maintenanceMode,
      siteName: settings.siteName ?? null,
      siteTitle: settings.siteTitle ?? null,
      homePageHtml: settings.homePageHtml ?? null,
      homePageImage: settings.homePageImage ?? null,
      homePageLogo: settings.homePageLogo ?? null,
      chatHeaderLogo: settings.chatHeaderLogo ?? null,
      siteOwnerUsernames: Array.isArray(settings.siteOwnerUsernames) ? settings.siteOwnerUsernames : [],
      managerUsernames: Array.isArray(settings.managerUsernames) ? settings.managerUsernames : [],
      premiumArticleTopTitle: settings.premiumArticleTopTitle ?? null,
      premiumArticleTopContent: settings.premiumArticleTopContent ?? null,
      premiumArticleMiddleTitle: settings.premiumArticleMiddleTitle ?? null,
      premiumArticleMiddleContent: settings.premiumArticleMiddleContent ?? null,
      premiumArticleBottomTitle: settings.premiumArticleBottomTitle ?? null,
      premiumArticleBottomContent: settings.premiumArticleBottomContent ?? null,
      premiumAndroidAppUrl: settings.premiumAndroidAppUrl ?? null,
      premiumIosAppUrl: settings.premiumIosAppUrl ?? null,
      welcomeMessageTemplate: settings.welcomeMessageTemplate ?? null,
      activeLoginDesign: settings.activeLoginDesign ?? LoginDesignType.STANDARD,
    };
  }

  async getChatPermissions(): Promise<ChatPermissionsResponseDto> {
    const settings = await this.getOrCreate();
    return {
      chatImageSendPermission:
        settings.chatImageSendPermission ?? AccessLevel.EVERYONE,
      chatVoiceSendPermission:
        settings.chatVoiceSendPermission ?? AccessLevel.MEMBERS,
      chatVoiceRecordSendPermission:
        settings.chatVoiceRecordSendPermission ?? AccessLevel.NONE,
      chatYoutubeSendPermission:
        settings.chatYoutubeSendPermission ?? AccessLevel.EVERYONE,
    };
  }

  async getCommunicationPermissions(): Promise<CommunicationPermissionsResponseDto> {
    const settings = await this.getOrCreate();
    return {
      guestCanWrite: Boolean(settings.guestCanWrite),
      memberAndGuestMicDurationSeconds:
        typeof settings.memberAndGuestMicDurationSeconds === 'number'
          ? settings.memberAndGuestMicDurationSeconds
          : 0,
      membersPrivateMessageEnabled: Boolean(
        settings.membersPrivateMessageEnabled,
      ),
      membersVoiceCallEnabled: Boolean(settings.membersVoiceCallEnabled),
      guestPrivateMessageEnabled: Boolean(settings.guestPrivateMessageEnabled),
      guestVoiceCallEnabled: Boolean(settings.guestVoiceCallEnabled),
      showMicrophonesOnMobile: settings.showMicrophonesOnMobile !== false,
    };
  }

  async getGuestWait(): Promise<GuestWaitResponseDto> {
    const settings = await this.getOrCreate();
    return {
      guestWaitSeconds:
        typeof settings.guestWaitSeconds === 'number'
          ? settings.guestWaitSeconds
          : 0,
      guestWaitUpdatedAt: settings.guestWaitUpdatedAt?.toISOString() ?? null,
    };
  }

  async getWebConsoleStats(): Promise<WebConsoleStatsResponseDto> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      registeredUsers,
      registeredLast24Hours,
      staffUsers,
      maleUsers,
      femaleUsers,
      staffMaleCount,
      staffFemaleCount,
      loginsLast30Days,
      loginsLast7Days,
      adminActionsLast30Days,
      adminActionsLast24Hours,
      topVisitorsRaw,
      deviceRecords,
      browserRecords,
      activeMaleRaw,
      activeFemaleRaw,
    ] = await Promise.all([
      this.userRepository.count({
        where: { isGuest: false, deletedAt: IsNull() },
      }),
      this.userRepository.count({
        where: {
          isGuest: false,
          deletedAt: IsNull(),
          createdAt: MoreThanOrEqual(last24Hours),
        },
      }),
      this.userRepository
        .createQueryBuilder('user')
        .leftJoin('user.role', 'role')
        .where('user.isGuest = false')
        .andWhere('user.deletedAt IS NULL')
        .andWhere('COALESCE(role.starCount, 0) >= 1')
        .getCount(),
      this.userRepository.count({
        where: { isGuest: false, deletedAt: IsNull(), gender: Gender.MALE },
      }),
      this.userRepository.count({
        where: { isGuest: false, deletedAt: IsNull(), gender: Gender.FEMALE },
      }),
      this.userRepository
        .createQueryBuilder('user')
        .leftJoin('user.role', 'role')
        .where('user.isGuest = false')
        .andWhere('user.deletedAt IS NULL')
        .andWhere('user.gender = :gender', { gender: Gender.MALE })
        .andWhere('COALESCE(role.starCount, 0) >= 1')
        .getCount(),
      this.userRepository
        .createQueryBuilder('user')
        .leftJoin('user.role', 'role')
        .where('user.isGuest = false')
        .andWhere('user.deletedAt IS NULL')
        .andWhere('user.gender = :gender', { gender: Gender.FEMALE })
        .andWhere('COALESCE(role.starCount, 0) >= 1')
        .getCount(),
      this.loginHistoryRepository
        .createQueryBuilder('lh')
        .where('lh.loginDate >= :last30Days', { last30Days })
        .getCount(),
      this.loginHistoryRepository
        .createQueryBuilder('lh')
        .where('lh.loginDate >= :last7Days', { last7Days })
        .getCount(),
      this.adminActionRepository
        .createQueryBuilder('aa')
        .where('aa.createdAt >= :last30Days', { last30Days })
        .getCount(),
      this.adminActionRepository
        .createQueryBuilder('aa')
        .where('aa.createdAt >= :last24Hours', { last24Hours })
        .getCount(),
      this.loginHistoryRepository
        .createQueryBuilder('lh')
        .select("COALESCE(NULLIF(lh.agentNickname, ''), lh.username)", 'label')
        .addSelect('COUNT(*)', 'count')
        .where('lh.loginDate >= :last30Days', { last30Days })
        .groupBy("COALESCE(NULLIF(lh.agentNickname, ''), lh.username)")
        .orderBy('COUNT(*)', 'DESC')
        .limit(8)
        .getRawMany<{ label: string; count: string }>(),
      this.loginHistoryRepository
        .createQueryBuilder('lh')
        .select('lh.device', 'label')
        .addSelect('COUNT(*)', 'count')
        .where('lh.loginDate >= :last30Days', { last30Days })
        .groupBy('lh.device')
        .getRawMany<{ label: string | null; count: string }>(),
      this.loginHistoryRepository
        .createQueryBuilder('lh')
        .select('lh.browser', 'label')
        .addSelect('COUNT(*)', 'count')
        .where('lh.loginDate >= :last30Days', { last30Days })
        .groupBy('lh.browser')
        .getRawMany<{ label: string | null; count: string }>(),
      this.loginHistoryRepository
        .createQueryBuilder('lh')
        .select(
          'COUNT(DISTINCT COALESCE(CAST(lh.userId AS text), lh.username))',
          'count',
        )
        .where('lh.loginDate >= :last30Days', { last30Days })
        .andWhere('lh.gender = :gender', { gender: Gender.MALE })
        .getRawOne<{ count: string }>(),
      this.loginHistoryRepository
        .createQueryBuilder('lh')
        .select(
          'COUNT(DISTINCT COALESCE(CAST(lh.userId AS text), lh.username))',
          'count',
        )
        .where('lh.loginDate >= :last30Days', { last30Days })
        .andWhere('lh.gender = :gender', { gender: Gender.FEMALE })
        .getRawOne<{ count: string }>(),
    ]);

    const activeMaleCount = Number(activeMaleRaw?.count ?? 0);
    const activeFemaleCount = Number(activeFemaleRaw?.count ?? 0);

    return {
      summary: {
        registeredUsers,
        registeredLast24Hours,
        staffUsers,
        staffFemaleCount,
        staffMaleCount,
        maleUsers,
        maleActivePercent: this.toPercent(activeMaleCount, maleUsers),
        femaleUsers,
        femaleActivePercent: this.toPercent(activeFemaleCount, femaleUsers),
        loginsLast30Days,
        loginsLast7Days,
        adminActionsLast30Days,
        adminActionsLast24Hours,
      },
      topVisitors: this.toRankedList(
        topVisitorsRaw.map((item) => ({
          label: item.label || 'Bilinmeyen',
          count: Number(item.count ?? 0),
        })),
      ),
      deviceUsage: {
        devices: this.toRankedList(
          this.aggregateDevices(deviceRecords, browserRecords),
        ),
        browsers: this.toRankedList(this.aggregateBrowsers(browserRecords)),
      },
    };
  }

  async getWebConsoleAnimations(): Promise<WebConsoleAnimationsResponseDto> {
    const animationsDir = this.resolveAnimationsDirectory();

    if (!animationsDir) {
      return {
        totalCount: 0,
        maxCount: SystemSettingsService.MAX_WEB_CONSOLE_ANIMATIONS,
        remainingSlots: SystemSettingsService.MAX_WEB_CONSOLE_ANIMATIONS,
        requiredWidth: null,
        requiredHeight: null,
        items: [],
      };
    }

    const rawItems = await this.readAnimationItems(animationsDir);
    return {
      totalCount: rawItems.length,
      maxCount: SystemSettingsService.MAX_WEB_CONSOLE_ANIMATIONS,
      remainingSlots: Math.max(
        SystemSettingsService.MAX_WEB_CONSOLE_ANIMATIONS - rawItems.length,
        0,
      ),
      requiredWidth: null,
      requiredHeight: null,
      items: rawItems,
    };
  }

  async uploadWebConsoleAnimations(
    files: Express.Multer.File[],
  ): Promise<{ message: string }> {
    if (!Array.isArray(files) || files.length === 0) {
      throw new BadRequestException(
        'Yüklenecek en az bir animasyon seçmelisiniz.',
      );
    }

    const animationsDir = await this.ensureAnimationsDirectory();
    const existingItems = await this.readAnimationItems(animationsDir);

    if (
      existingItems.length + files.length >
      SystemSettingsService.MAX_WEB_CONSOLE_ANIMATIONS
    ) {
      throw new BadRequestException(
        `En fazla ${SystemSettingsService.MAX_WEB_CONSOLE_ANIMATIONS} animasyon yüklenebilir.`,
      );
    }

    const existingNames = new Set(
      existingItems.map((item) => item.fileName.toLocaleLowerCase('tr-TR')),
    );

    const normalizedFiles = files.map((file) => {
      const normalizedFileName = this.normalizeAnimationFileName(
        file.originalname,
      );
      const dimensions = this.getImageDimensionsFromBuffer(
        file.buffer,
        path.extname(normalizedFileName),
      );

      return {
        ...file,
        normalizedFileName,
        dimensions,
      };
    });

    const duplicateName = normalizedFiles.find((file) =>
      existingNames.has(file.normalizedFileName.toLocaleLowerCase('tr-TR')),
    );

    if (duplicateName) {
      throw new BadRequestException(
        `"${duplicateName.normalizedFileName}" zaten mevcut. Aynı adlı dosya için değiştir işlemini kullanın.`,
      );
    }

    this.ensureMatchingAnimationDimensions(
      normalizedFiles.map((file) => ({
        fileName: file.normalizedFileName,
        width: file.dimensions.width,
        height: file.dimensions.height,
      })),
      null,
    );

    await Promise.all(
      normalizedFiles.map((file) =>
        fs.writeFile(
          path.join(animationsDir, file.normalizedFileName),
          file.buffer,
        ),
      ),
    );

    return {
      message: `${normalizedFiles.length} animasyon yüklendi.`,
    };
  }

  async replaceWebConsoleAnimation(
    fileName: string,
    file: Express.Multer.File | undefined,
  ): Promise<{ message: string }> {
    if (!file) {
      throw new BadRequestException(
        'Değiştirmek için bir animasyon dosyası seçmelisiniz.',
      );
    }

    const animationsDir = await this.ensureAnimationsDirectory();
    const normalizedTargetName =
      this.normalizeExistingAnimationFileName(fileName);
    const targetPath = path.join(animationsDir, normalizedTargetName);

    try {
      const targetStats = await fs.stat(targetPath);
      if (!targetStats.isFile()) {
        throw new NotFoundException('Animasyon bulunamadı.');
      }
    } catch {
      throw new NotFoundException('Animasyon bulunamadı.');
    }

    const targetExtension = path
      .extname(normalizedTargetName)
      .toLocaleLowerCase('tr-TR');
    const uploadedFileName = this.normalizeAnimationFileName(file.originalname);
    const uploadedExtension = path
      .extname(uploadedFileName)
      .toLocaleLowerCase('tr-TR');

    if (targetExtension !== uploadedExtension) {
      throw new BadRequestException(
        'Değiştirilen dosya mevcut animasyon ile aynı uzantıda olmalıdır.',
      );
    }

    const dimensions = this.getImageDimensionsFromBuffer(
      file.buffer,
      uploadedExtension,
    );
    await fs.writeFile(targetPath, file.buffer);

    return {
      message: `"${normalizedTargetName}" animasyonu güncellendi.`,
    };
  }

  async deleteWebConsoleAnimation(
    fileName: string,
  ): Promise<{ message: string }> {
    const animationsDir = await this.ensureAnimationsDirectory();
    const normalizedFileName =
      this.normalizeExistingAnimationFileName(fileName);
    const filePath = path.join(animationsDir, normalizedFileName);

    try {
      await fs.unlink(filePath);
    } catch {
      throw new NotFoundException('Silinecek animasyon bulunamadı.');
    }

    return {
      message: `"${normalizedFileName}" animasyonu silindi.`,
    };
  }

  async updateSettings(
    dto: UpdateSystemSettingsDto,
  ): Promise<SystemSettingsResponseDto> {
    const settings = await this.getOrCreate();
    const previousAccessSettings = {
      everyoneCanEnter: Boolean(settings.everyoneCanEnter),
      desktopLoginEnabled: Boolean(settings.desktopLoginEnabled),
      mobileLoginEnabled: Boolean(settings.mobileLoginEnabled),
      guestLoginEnabled: Boolean(settings.guestLoginEnabled),
      guestCanWrite: Boolean(settings.guestCanWrite),
    };

    const firstMessageDelayTouched =
      dto.firstMessageDelayEnabled !== undefined ||
      dto.firstMessageDelaySeconds !== undefined;
    const guestWaitTouched = dto.guestWaitSeconds !== undefined;

    // id gönderseler bile dikkate alma
    const { id: _ignoreId, ...rest } = dto;
    Object.assign(settings, rest);

    if (firstMessageDelayTouched) {
      settings.firstMessageDelayUpdatedAt = new Date();
    }

    if (guestWaitTouched) {
      settings.guestWaitUpdatedAt = new Date();
    }

    // Site media handles (data URLs to files)
    if (this.isDataUrl(dto.homePageImage)) {
      await this.deleteLocalFileIfExists(settings.homePageImage);
      settings.homePageImage = await this.saveDataUrlAndReturnPath(
        dto.homePageImage,
      );
    } else if (dto.homePageImage === null || dto.homePageImage === '') {
      await this.deleteLocalFileIfExists(settings.homePageImage);
      settings.homePageImage = null;
    }

    if (this.isDataUrl(dto.homePageLogo)) {
      await this.deleteLocalFileIfExists(settings.homePageLogo);
      settings.homePageLogo = await this.saveDataUrlAndReturnPath(
        dto.homePageLogo,
      );
    } else if (dto.homePageLogo === null || dto.homePageLogo === '') {
      await this.deleteLocalFileIfExists(settings.homePageLogo);
      settings.homePageLogo = null;
    }

    if (this.isDataUrl(dto.chatHeaderLogo)) {
      await this.deleteLocalFileIfExists(settings.chatHeaderLogo);
      settings.chatHeaderLogo = await this.saveDataUrlAndReturnPath(
        dto.chatHeaderLogo,
      );
    } else if (dto.chatHeaderLogo === null || dto.chatHeaderLogo === '') {
      await this.deleteLocalFileIfExists(settings.chatHeaderLogo);
      settings.chatHeaderLogo = null;
    }

    if (dto.siteOwnerUsernames !== undefined) {
      settings.siteOwnerUsernames = [...new Set(
        dto.siteOwnerUsernames.map((item) => String(item || '').trim()).filter(Boolean),
      )].slice(0, 12);
    }

    if (dto.managerUsernames !== undefined) {
      const ownerNames = new Set(
        (settings.siteOwnerUsernames ?? []).map((item) => item.toLocaleLowerCase('tr-TR')),
      );
      settings.managerUsernames = [...new Set(
        dto.managerUsernames.map((item) => String(item || '').trim()).filter(Boolean),
      )]
        .filter((item) => !ownerNames.has(item.toLocaleLowerCase('tr-TR')))
        .slice(0, 20);
    }

    const saved = await this.systemSettingsRepository.save(settings);
    const accessPolicy = {
      everyoneCanEnterDisabled:
        previousAccessSettings.everyoneCanEnter === true &&
        saved.everyoneCanEnter === false,
      guestLoginDisabled:
        previousAccessSettings.guestLoginEnabled === true &&
        saved.guestLoginEnabled === false,
      desktopLoginDisabled:
        previousAccessSettings.desktopLoginEnabled === true &&
        saved.desktopLoginEnabled === false,
      mobileLoginDisabled:
        previousAccessSettings.mobileLoginEnabled === true &&
        saved.mobileLoginEnabled === false,
    };
    const changedAccessFields = (
      [
        'everyoneCanEnter',
        'desktopLoginEnabled',
        'mobileLoginEnabled',
        'guestLoginEnabled',
        'guestCanWrite',
      ] as const
    ).filter(
      (field) =>
        previousAccessSettings[field] !==
        Boolean(saved[field as keyof SystemSettings]),
    );
    const accessPolicyChanged = changedAccessFields.length > 0;

    if (
      accessPolicy.everyoneCanEnterDisabled ||
      accessPolicy.guestLoginDisabled ||
      accessPolicy.desktopLoginDisabled ||
      accessPolicy.mobileLoginDisabled
    ) {
      this.roomsGateway.disconnectMembersForSystemAccessUpdate?.(accessPolicy);
    }

    this.roomsGateway.emitTenantSettingsUpdated({
      scope: 'system',
      showMicrophonesOnMobile: saved.showMicrophonesOnMobile !== false,
      mobileHeaderColor: saved.mobileHeaderColor || '#0057B8',
      mobileFooterColor: saved.mobileFooterColor || '#0057B8',
      chatSiteTheme: ['dark', 'light', 'glass', 'neon'].includes(saved.chatSiteTheme) ? saved.chatSiteTheme : 'dark',
      communicationPermissions: {
        guestCanWrite: Boolean(saved.guestCanWrite),
        memberAndGuestMicDurationSeconds:
          typeof saved.memberAndGuestMicDurationSeconds === 'number'
            ? saved.memberAndGuestMicDurationSeconds
            : 0,
        membersPrivateMessageEnabled: Boolean(
          saved.membersPrivateMessageEnabled,
        ),
        membersVoiceCallEnabled: Boolean(saved.membersVoiceCallEnabled),
        guestPrivateMessageEnabled: Boolean(saved.guestPrivateMessageEnabled),
        guestVoiceCallEnabled: Boolean(saved.guestVoiceCallEnabled),
        showMicrophonesOnMobile: saved.showMicrophonesOnMobile !== false,
      },
      accessPolicyChanged,
      changedFields: changedAccessFields,
    });
    return this.toResponse(saved);
  }

  async repairRoot(actorUsername: string): Promise<{ message: string }> {
    const rootRole = await this.findRootRole();

    const rootUser =
      (await this.findRootUser()) ??
      this.userRepository.create({
        username: 'ROOT',
        password: await bcrypt.hash(randomUUID(), 10),
        gender: Gender.MALE,
        isGuest: false,
      });

    if (rootUser.id) {
      await this.userBanRepository.delete({ userId: rootUser.id });
    }

    rootUser.micBanned = false;
    rootUser.username = 'ROOT';
    rootUser.micBannedByStarCount = 0;
    rootUser.cameraBanned = false;
    rootUser.cameraBannedByStarCount = 0;
    rootUser.globalMuted = false;
    rootUser.globalMutedByStarCount = 0;
    rootUser.membershipExpiresAt = new Date('2030-12-31T23:59:59.000Z');
    rootUser.role = rootRole;
    rootUser.roleId = rootRole.id;
    rootUser.permissions = Object.values(PERMISSION_LABELS);
    rootUser.protection = true;
    rootUser.protectedByStarCount = rootRole.starCount ?? 0;

    await this.userRepository.save(rootUser);
    await this.emitRootKick(actorUsername);

    return { message: 'Root hesabı onarıldı.' };
  }

  async changeRootPassword(
    password: string,
    actorUsername: string,
  ): Promise<{ message: string }> {
    const nextPassword = String(password ?? '').trim();
    if (!nextPassword) {
      throw new BadRequestException('Yeni şifre boş bırakılamaz.');
    }

    const rootRole = await this.findRootRole();

    const existingRoot = await this.findRootUser();
    const rootUser =
      existingRoot ??
      this.userRepository.create({
        username: 'ROOT',
        gender: Gender.MALE,
        isGuest: false,
      });

    rootUser.password = await bcrypt.hash(nextPassword, 10);
    if (!existingRoot) {
      rootUser.username = 'ROOT';
      rootUser.micBanned = false;
      rootUser.micBannedByStarCount = 0;
      rootUser.cameraBanned = false;
      rootUser.cameraBannedByStarCount = 0;
      rootUser.globalMuted = false;
      rootUser.globalMutedByStarCount = 0;
      rootUser.membershipExpiresAt = new Date('2030-12-31T23:59:59.000Z');
      rootUser.role = rootRole;
      rootUser.roleId = rootRole.id;
      rootUser.permissions = Object.values(PERMISSION_LABELS);
      rootUser.protection = true;
      rootUser.protectedByStarCount = rootRole.starCount ?? 0;
    }

    await this.userRepository.save(rootUser);
    await this.emitRootKick(actorUsername);

    return { message: 'Root şifresi değiştirildi.' };
  }

  async sendSystemMessage(content: string): Promise<{ message: string }> {
    const trimmedContent = String(content ?? '').trim();
    if (!trimmedContent) {
      throw new BadRequestException('Sistem mesajı boş bırakılamaz.');
    }

    const now = Date.now();
    if (
      this.lastSystemMessageSentAt !== null &&
      now - this.lastSystemMessageSentAt <
        SystemSettingsService.SYSTEM_MESSAGE_COOLDOWN_MS
    ) {
      const remainingMs =
        SystemSettingsService.SYSTEM_MESSAGE_COOLDOWN_MS -
        (now - this.lastSystemMessageSentAt);
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new BadRequestException(
        `Yeni sistem mesajı göndermek için ${remainingMinutes} dakika bekleyin.`,
      );
    }

    this.roomsGateway.emitSystemMessage({
      message: trimmedContent,
      isSystemMessage: true,
      timestamp: new Date().toISOString(),
    });
    this.lastSystemMessageSentAt = now;

    return { message: 'Sistem mesajı gönderildi.' };
  }

  async startSystemReset(): Promise<{
    message: string;
    countdownSeconds: number;
    remainingDurationMs: number;
    timestamp: string;
    deletedMessagesCount: number;
  }> {
    const countdownSeconds = 10;
    const deleteResult = await this.messageRepository.softDelete({
      deletedAt: IsNull(),
    });

    this.roomsGateway.emitSystemResetStarted({
      countdownSeconds,
      message: 'Sistem resetleniyor',
    });
    const activeReset = this.roomsGateway.getActiveSystemResetPayload?.();

    return {
      message: 'Sistem resetleme başlatıldı.',
      countdownSeconds,
      remainingDurationMs: activeReset?.remainingDurationMs ?? 30_000,
      timestamp: activeReset?.timestamp ?? new Date().toISOString(),
      deletedMessagesCount: deleteResult.affected ?? 0,
    };
  }

  getSystemResetStatus(): {
    active: boolean;
    countdownSeconds?: number;
    remainingDurationMs?: number;
    message?: string;
    timestamp?: string;
  } {
    const activeReset = this.roomsGateway.getActiveSystemResetPayload?.();
    if (!activeReset) {
      return { active: false };
    }

    return {
      active: true,
      countdownSeconds: activeReset.countdownSeconds,
      remainingDurationMs: activeReset.remainingDurationMs,
      message: activeReset.message,
      timestamp: activeReset.timestamp,
    };
  }

  private async getOrCreate(): Promise<SystemSettings> {
    let settings = await this.systemSettingsRepository.findOne({
      where: { id: 1 },
    });

    if (!settings) {
      settings = this.systemSettingsRepository.create({
        id: 1,
        // defaults already set in entity
      });
      settings = await this.systemSettingsRepository.save(settings);
    }

    return settings;
  }

  private toResponse(settings: SystemSettings): SystemSettingsResponseDto {
    return {
      id: settings.id,
      everyoneCanEnter: settings.everyoneCanEnter,
      desktopLoginEnabled: settings.desktopLoginEnabled,
      mobileLoginEnabled: settings.mobileLoginEnabled,
      guestLoginEnabled: settings.guestLoginEnabled,
      newRegistrationEnabled: settings.newRegistrationEnabled,
      guestCanWrite: settings.guestCanWrite,
      staffCanChangeNickname: settings.staffCanChangeNickname,
      friendsPrivateMessageMembersOnly:
        settings.friendsPrivateMessageMembersOnly,
      membersPrivateMessageEnabled: settings.membersPrivateMessageEnabled,
      membersVoiceCallEnabled: settings.membersVoiceCallEnabled,
      guestPrivateMessageEnabled: settings.guestPrivateMessageEnabled,
      guestVoiceCallEnabled: settings.guestVoiceCallEnabled,
      firstMessageDelayEnabled: settings.firstMessageDelayEnabled,
      firstMessageDelaySeconds:
        this.normalizeFirstMessageDelaySeconds(settings),
      firstMessageDelayUpdatedAt:
        settings.firstMessageDelayUpdatedAt?.toISOString() ?? null,
      guestWaitSeconds: settings.guestWaitSeconds,
      guestWaitUpdatedAt: settings.guestWaitUpdatedAt?.toISOString() ?? null,
      memberAndGuestMicDurationSeconds:
        settings.memberAndGuestMicDurationSeconds,
      siteLanguage: settings.siteLanguage ?? SiteLanguage.TR,
      chatImageSendPermission:
        settings.chatImageSendPermission ?? AccessLevel.EVERYONE,
      chatVoiceSendPermission:
        settings.chatVoiceSendPermission ?? AccessLevel.MEMBERS,
      chatVoiceRecordSendPermission:
        settings.chatVoiceRecordSendPermission ?? AccessLevel.NONE,
      chatYoutubeSendPermission:
        settings.chatYoutubeSendPermission ?? AccessLevel.EVERYONE,
      siteName: settings.siteName ?? null,
      siteTitle: settings.siteTitle ?? null,
      siteDescription: settings.siteDescription ?? null,
      homePageHtml: settings.homePageHtml ?? null,
      welcomeMessageTemplate: settings.welcomeMessageTemplate ?? null,
      activeLoginDesign: settings.activeLoginDesign ?? LoginDesignType.STANDARD,
      maxUserCount: settings.maxUserCount,
      maintenanceMode: settings.maintenanceMode,
      showMicrophonesOnMobile: settings.showMicrophonesOnMobile,
      mobileHeaderColor: settings.mobileHeaderColor || '#0057B8',
      mobileFooterColor: settings.mobileFooterColor || '#0057B8',
      chatSiteTheme: ['dark', 'light', 'glass', 'neon'].includes(settings.chatSiteTheme) ? settings.chatSiteTheme : 'dark',
      homePageImage: settings.homePageImage ?? null,
      homePageLogo: settings.homePageLogo ?? null,
      chatHeaderLogo: settings.chatHeaderLogo ?? null,
      siteOwnerUsernames: Array.isArray(settings.siteOwnerUsernames) ? settings.siteOwnerUsernames : [],
      managerUsernames: Array.isArray(settings.managerUsernames) ? settings.managerUsernames : [],
      premiumArticleTopTitle: settings.premiumArticleTopTitle ?? null,
      premiumArticleTopContent: settings.premiumArticleTopContent ?? null,
      premiumArticleMiddleTitle: settings.premiumArticleMiddleTitle ?? null,
      premiumArticleMiddleContent: settings.premiumArticleMiddleContent ?? null,
      premiumArticleBottomTitle: settings.premiumArticleBottomTitle ?? null,
      premiumArticleBottomContent: settings.premiumArticleBottomContent ?? null,
      premiumAndroidAppUrl: settings.premiumAndroidAppUrl ?? null,
      premiumIosAppUrl: settings.premiumIosAppUrl ?? null,
    };
  }

  private toPercent(value: number, total: number): number {
    if (!total || total <= 0) return 0;
    return Math.round((value / total) * 100);
  }

  private toRankedList(
    items: Array<{ label: string; count: number }>,
  ): WebConsoleStatsListItemDto[] {
    const maxValue = items.reduce((max, item) => Math.max(max, item.count), 0);
    return items.map((item) => ({
      label: item.label,
      count: item.count,
      percent: maxValue > 0 ? Math.round((item.count / maxValue) * 100) : 0,
    }));
  }

  private aggregateDevices(
    deviceRecords: Array<{ label: string | null; count: string }>,
    browserRecords: Array<{ label: string | null; count: string }>,
  ): Array<{ label: string; count: number }> {
    const mobileCount = deviceRecords.reduce(
      (sum, item) =>
        String(item.label || '')
          .toLocaleLowerCase('tr-TR')
          .includes('mobile')
          ? sum + Number(item.count ?? 0)
          : sum,
      0,
    );
    const desktopCount = deviceRecords.reduce(
      (sum, item) =>
        String(item.label || '')
          .toLocaleLowerCase('tr-TR')
          .includes('desktop')
          ? sum + Number(item.count ?? 0)
          : sum,
      0,
    );
    const tabletCount = deviceRecords.reduce(
      (sum, item) =>
        String(item.label || '')
          .toLocaleLowerCase('tr-TR')
          .includes('tablet')
          ? sum + Number(item.count ?? 0)
          : sum,
      0,
    );

    const safariMobileCount = browserRecords.reduce((sum, item) => {
      const label = String(item.label || '').toLocaleLowerCase('tr-TR');
      return label.includes('safari') ? sum + Number(item.count ?? 0) : sum;
    }, 0);

    const iosCount = Math.min(mobileCount, safariMobileCount);
    const androidCount = Math.max(0, mobileCount - iosCount + tabletCount);

    return [
      { label: 'Android', count: androidCount },
      { label: 'IOS', count: iosCount },
      { label: 'Masa Üstü', count: desktopCount },
    ];
  }

  private aggregateBrowsers(
    browserRecords: Array<{ label: string | null; count: string }>,
  ): Array<{ label: string; count: number }> {
    const browserMap = new Map<string, number>([
      ['Chrome', 0],
      ['Firefox', 0],
      ['Edge', 0],
      ['Opera', 0],
      ['Safari', 0],
      ['Diğer', 0],
    ]);

    browserRecords.forEach((item) => {
      const label = String(item.label || '').toLocaleLowerCase('tr-TR');
      const count = Number(item.count ?? 0);
      if (label.includes('chrome')) {
        browserMap.set('Chrome', (browserMap.get('Chrome') || 0) + count);
      } else if (label.includes('firefox')) {
        browserMap.set('Firefox', (browserMap.get('Firefox') || 0) + count);
      } else if (label.includes('edge')) {
        browserMap.set('Edge', (browserMap.get('Edge') || 0) + count);
      } else if (label.includes('opera')) {
        browserMap.set('Opera', (browserMap.get('Opera') || 0) + count);
      } else if (label.includes('safari')) {
        browserMap.set('Safari', (browserMap.get('Safari') || 0) + count);
      } else {
        browserMap.set('Diğer', (browserMap.get('Diğer') || 0) + count);
      }
    });

    return Array.from(browserMap.entries()).map(([label, count]) => ({
      label,
      count,
    }));
  }

  private async findRootUser(): Promise<User | null> {
    const rootUser = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('LOWER(user.username) = :username', { username: 'root' })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    return rootUser;
  }

  private async findRootRole(): Promise<Role> {
    const rootRole = await this.roleRepository.findOne({
      where: { starCount: 24 },
      order: { id: 'ASC' },
    });

    if (!rootRole) {
      throw new BadRequestException('24 rütbeli root rolü bulunamadı.');
    }

    return rootRole;
  }

  private async emitRootKick(actorUsername: string): Promise<void> {
    await this.moderationGateway.emitUserKicked({
      username: 'root',
      kickedByUsername: actorUsername || 'Sistem',
      reason: 'Root işlemleri uygulandı',
      actorStarCount: Number.MAX_SAFE_INTEGER,
    });
  }

  private resolveAnimationsDirectory(): string | null {
    const candidatePaths = [
      path.resolve(process.cwd(), 'frontend/public/animasyonlar'),
      path.resolve(process.cwd(), 'kingmobile-frontend/public/animasyonlar'),
      path.resolve(process.cwd(), '../frontend/public/animasyonlar'),
      path.resolve(process.cwd(), '../kingmobile-frontend/public/animasyonlar'),
    ];

    for (const candidatePath of candidatePaths) {
      try {
        const stats = statSync(candidatePath);
        if (stats.isDirectory()) {
          return candidatePath;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private async ensureAnimationsDirectory(): Promise<string> {
    const existingDirectory = this.resolveAnimationsDirectory();
    if (existingDirectory) {
      await fs.mkdir(existingDirectory, { recursive: true });
      return existingDirectory;
    }

    const fallbackDirectory = path.resolve(
      process.cwd(),
      'kingmobile-frontend/public/animasyonlar',
    );
    await fs.mkdir(fallbackDirectory, { recursive: true });
    return fallbackDirectory;
  }

  private async readAnimationItems(
    animationsDir: string,
  ): Promise<WebConsoleAnimationItemDto[]> {
    const entries = await fs.readdir(animationsDir, { withFileTypes: true });

    const rawItems = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .filter((entry) =>
          SystemSettingsService.ALLOWED_ANIMATION_EXTENSIONS.has(
            path.extname(entry.name).toLocaleLowerCase('tr-TR'),
          ),
        )
        .map(async (entry) => {
          const fullPath = path.join(animationsDir, entry.name);
          const [stats, buffer] = await Promise.all([
            fs.stat(fullPath),
            fs.readFile(fullPath),
          ]);
          const dimensions = this.getImageDimensionsFromBuffer(
            buffer,
            path.extname(entry.name),
          );

          return {
            fileName: entry.name,
            url: `/animasyonlar/${entry.name}`,
            extension: path
              .extname(entry.name)
              .replace('.', '')
              .toLocaleLowerCase('tr-TR'),
            sizeBytes: stats.size,
            updatedAt: stats.mtime.toISOString(),
            width: dimensions.width,
            height: dimensions.height,
          };
        }),
    );

    rawItems.sort((left, right) => {
      const leftNumeric = Number.parseInt(left.fileName, 10);
      const rightNumeric = Number.parseInt(right.fileName, 10);
      const leftIsNumeric = Number.isFinite(leftNumeric);
      const rightIsNumeric = Number.isFinite(rightNumeric);

      if (leftIsNumeric && rightIsNumeric && leftNumeric !== rightNumeric) {
        return leftNumeric - rightNumeric;
      }

      return left.fileName.localeCompare(right.fileName, 'tr');
    });

    return rawItems;
  }

  private normalizeAnimationFileName(originalName: string): string {
    const trimmedName = path.basename(String(originalName ?? '').trim());
    const extension = path.extname(trimmedName).toLocaleLowerCase('tr-TR');

    if (!SystemSettingsService.ALLOWED_ANIMATION_EXTENSIONS.has(extension)) {
      throw new BadRequestException(
        'Sadece GIF, PNG, JPG, JPEG veya WEBP dosyaları yüklenebilir.',
      );
    }

    const baseName = path.basename(trimmedName, path.extname(trimmedName));
    const sanitizedBaseName = baseName
      .normalize('NFKD')
      .replace(/[^\w-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLocaleLowerCase('tr-TR');

    if (!sanitizedBaseName) {
      throw new BadRequestException('Geçerli bir dosya adı gerekli.');
    }

    return `${sanitizedBaseName}${extension}`;
  }

  private normalizeExistingAnimationFileName(fileName: string): string {
    const trimmedName = path.basename(String(fileName ?? '').trim());
    const extension = path.extname(trimmedName).toLocaleLowerCase('tr-TR');

    if (
      !trimmedName ||
      !SystemSettingsService.ALLOWED_ANIMATION_EXTENSIONS.has(extension)
    ) {
      throw new BadRequestException('Geçersiz animasyon dosya adı.');
    }

    return trimmedName;
  }

  private getRequiredAnimationDimensions(
    items: Array<{ width: number; height: number }>,
  ): { width: number; height: number } | null {
    const firstItem = items[0];
    if (!firstItem) {
      return null;
    }

    return {
      width: firstItem.width,
      height: firstItem.height,
    };
  }

  private ensureMatchingAnimationDimensions(
    items: Array<{ fileName: string; width: number; height: number }>,
    requiredDimensions: { width: number; height: number } | null,
  ): void {
    if (!items.length) return;

    const target = requiredDimensions ?? {
      width: items[0].width,
      height: items[0].height,
    };

    const invalidItem = items.find(
      (item) => item.width !== target.width || item.height !== target.height,
    );

    if (invalidItem) {
      throw new BadRequestException(
        `Tüm animasyonlar ${target.width}x${target.height} boyutunda olmalıdır. "${invalidItem.fileName}" bu ölçüye uymuyor.`,
      );
    }
  }

  private getImageDimensionsFromBuffer(
    buffer: Buffer,
    extension: string,
  ): { width: number; height: number } {
    const normalizedExtension = extension
      .replace('.', '')
      .toLocaleLowerCase('tr-TR');

    switch (normalizedExtension) {
      case 'png':
        return this.getPngDimensions(buffer);
      case 'gif':
        return this.getGifDimensions(buffer);
      case 'jpg':
      case 'jpeg':
        return this.getJpegDimensions(buffer);
      case 'webp':
        return this.getWebpDimensions(buffer);
      default:
        throw new BadRequestException('Desteklenmeyen animasyon formatı.');
    }
  }

  private getPngDimensions(buffer: Buffer): { width: number; height: number } {
    if (buffer.length < 24) {
      throw new BadRequestException('PNG dosyası okunamadı.');
    }

    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  private getGifDimensions(buffer: Buffer): { width: number; height: number } {
    if (buffer.length < 10) {
      throw new BadRequestException('GIF dosyası okunamadı.');
    }

    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
    };
  }

  private getJpegDimensions(buffer: Buffer): { width: number; height: number } {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      throw new BadRequestException('JPEG dosyası okunamadı.');
    }

    let offset = 2;

    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      const blockLength = buffer.readUInt16BE(offset + 2);

      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      ) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }

      offset += 2 + blockLength;
    }

    throw new BadRequestException('JPEG boyut bilgisi okunamadı.');
  }

  private getWebpDimensions(buffer: Buffer): { width: number; height: number } {
    if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
      throw new BadRequestException('WEBP dosyası okunamadı.');
    }

    const chunkHeader = buffer.toString('ascii', 12, 16);

    if (chunkHeader === 'VP8 ') {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }

    if (chunkHeader === 'VP8L') {
      const bits =
        buffer[21] |
        (buffer[22] << 8) |
        (buffer[23] << 16) |
        (buffer[24] << 24);

      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }

    if (chunkHeader === 'VP8X') {
      return {
        width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
        height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16),
      };
    }

    throw new BadRequestException('WEBP boyut bilgisi okunamadı.');
  }

  private isUrl(value?: string | null): boolean {
    if (!value) return false;
    return /^https?:\/\//i.test(value);
  }

  private isDataUrl(value?: string | null): value is string {
    if (!value) return false;
    return /^data:[^;]+;base64,/i.test(value);
  }

  private async deleteLocalFileIfExists(filePath?: string | null) {
    if (!filePath || this.isUrl(filePath) || this.isDataUrl(filePath)) {
      return;
    }

    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    try {
      await fs.unlink(resolvedPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async saveDataUrlAndReturnPath(dataUrl: string): Promise<string> {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
    if (!match) {
      throw new BadRequestException('Geçersiz data URL formatı.');
    }

    const mimeType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const ext = this.mimeToExtension(mimeType);

    const uploadDir = path.join(process.cwd(), 'uploads', 'site');
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}${ext ? `.${ext}` : ''}`;
    const fullPath = path.join(uploadDir, filename);

    await fs.writeFile(fullPath, buffer);

    return path.relative(process.cwd(), fullPath);
  }

  private mimeToExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };

    return map[mimeType] ?? '';
  }

  private normalizeFirstMessageDelaySeconds(settings: {
    firstMessageDelayEnabled?: boolean;
    firstMessageDelaySeconds?: number | null;
  }): number {
    if (!settings.firstMessageDelayEnabled) {
      return settings.firstMessageDelaySeconds ?? 0;
    }

    const seconds = Number(settings.firstMessageDelaySeconds) || 0;
    return seconds > 0 ? seconds : 0;
  }
}
