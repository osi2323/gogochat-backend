import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsSelect,
  IsNull,
  LessThan,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { User } from './entities/user.entity';
import { Gender } from '../common/enums/gender.enum';
import * as bcrypt from 'bcrypt';
import { StatusModeService } from '../status-mode/status-mode.service';
import { Role } from '../role/entities/role.entity';
import { SystemSettings } from '../settings/entities/system-settings.entity';
import { UpdateUserByAdminDto } from './dto/update-user-by-admin.dto';
import {
  ChatPreferences,
  defaultChatPreferences,
} from './chat-preferences.constants';
import { isProtectedActionBlocked } from '../common/utils/protection-access.util';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';

const ACTION_NOT_ALLOWED_MESSAGE = 'Bu işlemi yapmaya hakkınız yok.';

const allowedJoinEffects = [
  'ocean-ribbon',
  'ruby-crown',
  'silver-comet',
  'aurora-prism',
  'royal-onyx',
  'gif-effect-1',
  'gif-effect-2',
  'gif-effect-3',
  'gif-effect-4',
  'gif-effect-dplpd',
] as const;
type JoinEffect = (typeof allowedJoinEffects)[number];

const allowedUserGifFiles = [
  'balon.gif',
  'bayrak.gif.gif',
  'gul.gif',
  'kalpler.gif',
  'kar.gif.gif',
  'kelebek.gif',
  'yangın.gif',
  'yılbasi.gif',
] as const;

const legacyUserGifAliases: Record<string, (typeof allowedUserGifFiles)[number]> = {
  'baris_guvercini.gif.gif': 'kelebek.gif',
  'baris_guvercini_2.gif.gif': 'kelebek.gif',
  'kalpler.gif.gif': 'kalpler.gif',
  'sinek.gif.gif': 'yılbasi.gif',
  'yaprak.gif': 'yılbasi.gif',
  'yagin.gif.gif': 'yangın.gif',
  'yangin.gif.gif': 'yangın.gif',
};

const maxFlashNickBytes = 25 * 1024 * 1024;

@Injectable()
export class UserService {
  private readonly userSelect: FindOptionsSelect<User> = {
    id: true,
    username: true,
    isGuest: true,
    guestExpiresAt: true,
    gender: true,
    frame: true,
    icon: true,
    fontName: true,
    granite: true,
    nickColor: true,
    userGif: true,
    flashNick: true,
    accountFrozen: true,
    accountFrozenAt: true,
    accountFrozenByStarCount: true,
    joinEffect: true,
    protection: true,
    protectedByStarCount: true,
    micBanned: true,
    micBannedByStarCount: true,
    cameraBanned: true,
    cameraBannedByStarCount: true,
    globalMuted: true,
    globalMutedByStarCount: true,
    membershipExpiresAt: true,
    permissions: true,
    chatPreferences: true,
    roleId: true,
    statusModeId: true,
    createdAt: true,
    updatedAt: true,
    lastLoginAt: true,
    role: {
      id: true,
      name: true,
      microphoneDuration: true,
      starColor: true,
      starCount: true,
      icon: true,
      permissions: true,
      createdAt: true,
      updatedAt: true,
    },
    statusMode: {
      id: true,
      name: true,
    },
  };

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly statusModeService: StatusModeService,
    @InjectRepository(SystemSettings)
    private readonly systemSettingsRepository?: Repository<SystemSettings>,
  ) {}

  private convertPermissions(permissions: Record<string, boolean>): string[] {
    return Object.entries(permissions)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
  }

  private hasPermissionInList(
    permissions: string[] | null | undefined,
    permissionLabel: string,
  ): boolean {
    const normalizedTarget = String(permissionLabel ?? '')
      .trim()
      .toLocaleLowerCase('tr-TR')
      .replace(/\s+/g, ' ');

    return (permissions ?? []).some(
      (permission) =>
        String(permission ?? '')
          .trim()
          .toLocaleLowerCase('tr-TR')
          .replace(/\s+/g, ' ') === normalizedTarget,
    );
  }

  private async getUserWithRelations(userId: number): Promise<User> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.statusMode', 'statusMode')
      .where('user.id = :userId', { userId })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    return user;
  }

  private normalizeFlashNick(flashNick: string | null | undefined): string | null {
    let normalizedFlashNick: string | null = null;

    if (typeof flashNick === 'string' && flashNick.trim().length > 0) {
      const trimmed = flashNick.trim();
      const match = trimmed.match(
        /^data:(image\/png|image\/jpeg|image\/gif);base64,([A-Za-z0-9+/=\s]+)$/i,
      );

      if (!match) {
        throw new BadRequestException('Geçersiz flash nick formatı');
      }

      const mime = match[1].toLowerCase();
      const rawBase64 = match[2].replace(/\s+/g, '');

      if (rawBase64.length === 0 || rawBase64.length % 4 !== 0) {
        throw new BadRequestException('Geçersiz flash nick base64 verisi');
      }

      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(rawBase64)) {
        throw new BadRequestException('Geçersiz flash nick base64 verisi');
      }

      const binary = Buffer.from(rawBase64, 'base64');
      if (!binary.length) {
        throw new BadRequestException('Geçersiz flash nick içeriği');
      }

      if (binary.length > maxFlashNickBytes) {
        throw new BadRequestException('Flash nick görseli en fazla 25MB olabilir');
      }

      normalizedFlashNick = `data:${mime};base64,${rawBase64}`;
    }

    return normalizedFlashNick;
  }

  private normalizeUsername(input: string): string {
    return String(input ?? '')
      .trim()
      .toLowerCase();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
    });
  }

  async findByUsernameCaseInsensitive(username: string): Promise<User | null> {
    const normalizedUsername = this.normalizeUsername(username);
    if (!normalizedUsername) {
      return null;
    }

    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.statusMode', 'statusMode')
      .where('LOWER(user.username) = :normalizedUsername', {
        normalizedUsername,
      })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
  }

  async findMemberByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username, isGuest: false },
    });
  }

  async findMemberByUsernameCaseInsensitive(
    username: string,
  ): Promise<User | null> {
    const normalizedUsername = this.normalizeUsername(username);
    if (!normalizedUsername) {
      return null;
    }

    return this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.username) = :normalizedUsername', {
        normalizedUsername,
      })
      .andWhere('user.isGuest = :isGuest', { isGuest: false })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.statusMode', 'statusMode')
      .where('user.id = :id', { id })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
  }

  async findByIdWithFullSelect(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['role', 'statusMode'],
      select: this.userSelect,
    });
  }

  async create(
    username: string,
    password: string,
    gender: Gender,
  ): Promise<User> {
    const existingUser =
      await this.findMemberByUsernameCaseInsensitive(username);
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    await this.userRepository.softDelete({ username, isGuest: true });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Yeni üyeye ID=1 gibi sabit bir rütbe vermek güvenli değil.
    // Bazı kurulumlarda ID=1 KURUCU/ROOT olabildiği için, üyelik kaydı
    // her zaman 0 yıldızlı "uye" rütbesini isim/yıldız üzerinden çözer.
    const defaultRole =
      (await this.roleRepository
        .createQueryBuilder('role')
        .where('LOWER(role.name) = :memberRole', { memberRole: 'uye' })
        .andWhere('COALESCE(role.starCount, 0) = 0')
        .orderBy('role.id', 'ASC')
        .getOne()) ??
      (await this.roleRepository
        .createQueryBuilder('role')
        .where('COALESCE(role.starCount, 0) = 0')
        .orderBy('role.id', 'ASC')
        .getOne());

    const initialPermissions = defaultRole
      ? this.convertPermissions(defaultRole.permissions)
      : [];

    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      gender,
      roleId: defaultRole?.id ?? null,
      permissions: initialPermissions,
    });

    return this.userRepository.save(user);
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const normalizedUsername = this.normalizeUsername(username);
    if (!normalizedUsername) {
      return null;
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.statusMode', 'statusMode')
      .where('LOWER(user.username) = :normalizedUsername', {
        normalizedUsername,
      })
      .andWhere('user.isGuest = :isGuest', { isGuest: false })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    if (!user) {
      return null;
    }

    if (user.accountFrozen) {
      throw new ForbiddenException(
        'Bu hesap dondurulmuş. Hesabınızı açtırmak için bir yöneticiyle iletişime geçin.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async createOrRefreshGuest(username: string, gender: Gender): Promise<User> {
    await this.cleanupExpiredGuests();

    const existingMember =
      await this.findMemberByUsernameCaseInsensitive(username);
    if (existingMember) {
      throw new ConflictException('Username already exists');
    }

    await this.userRepository.softDelete({ username, isGuest: true });

    const randomPassword = await bcrypt.hash(
      `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      10,
    );

    const guestExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const guestUser = this.userRepository.create({
      username,
      password: randomPassword,
      gender,
      isGuest: true,
      guestExpiresAt,
      roleId: undefined,
      permissions: [],
    });

    return this.userRepository.save(guestUser);
  }

  async cleanupExpiredGuests(): Promise<void> {
    const now = new Date();
    await this.userRepository
      .createQueryBuilder()
      .softDelete()
      .where('isGuest = :isGuest', { isGuest: true })
      .andWhere('guestExpiresAt IS NOT NULL')
      .andWhere('guestExpiresAt < :now', { now })
      .execute();
  }

  async touchGuestExpiry(userId: number): Promise<void> {
    await this.userRepository.update(
      { id: userId, isGuest: true, deletedAt: IsNull() },
      {
        guestExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    );
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentValid) {
      throw new ForbiddenException('Mevcut şifre hatalı');
    }

    if (currentPassword === newPassword) {
      throw new ForbiddenException('Yeni şifre eski şifre ile aynı olamaz');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await this.userRepository.save(user);
  }

  async findByMinStarCount(minStarCount: number): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.statusMode', 'statusMode')
      .where('user.deletedAt IS NULL')
      .andWhere('LOWER(user.username) != :rootUsername', {
        rootUsername: 'root',
      })
      .andWhere('role.starCount >= :minStarCount', { minStarCount })
      .getMany();
  }

  async findByMaxStarCount(maxStarCount: number): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.statusMode', 'statusMode')
      .where('user.deletedAt IS NULL')
      .andWhere('user.isGuest = :isGuest', { isGuest: false })
      .andWhere('LOWER(user.username) != :rootUsername', {
        rootUsername: 'root',
      })
      .andWhere('(role.starCount < :maxStarCount OR role.id IS NULL)', {
        maxStarCount,
      })
      .getMany();
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['role', 'statusMode'],
      select: this.userSelect,
    });
  }

  async updateFrame(userId: number, frame: string | null): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const normalizedFrame =
      typeof frame === 'string' && frame.trim().length > 0
        ? frame.trim()
        : null;

    if (user.isGuest && normalizedFrame) {
      throw new ForbiddenException(
        'Çerçeve seçmek için üye girişi yapmalısınız',
      );
    }

    user.frame = normalizedFrame;

    await this.userRepository.save(user);

    return this.getUserWithRelations(userId);
  }

  async updateIcon(userId: number, icon: string | null): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const previousIcon = user.icon;
    const normalizedIcon = await this.normalizeUserIconInput(icon);

    if (user.isGuest && normalizedIcon) {
      throw new ForbiddenException('İkon seçmek için üye girişi yapmalısınız');
    }

    user.icon = normalizedIcon;

    await this.userRepository.save(user);
    await this.removeReplacedUserIconFile(previousIcon, normalizedIcon);

    return this.getUserWithRelations(userId);
  }

  private async normalizeUserIconInput(icon: string | null): Promise<string | null> {
    const normalized =
      typeof icon === 'string' && icon.trim().length > 0 ? icon.trim() : null;
    if (!normalized) return null;

    if (/^data:image\/[^;]+;base64,/i.test(normalized)) {
      return this.persistUserIconDataUrl(normalized);
    }

    if (normalized.startsWith('uploads/')) {
      return `/${normalized}`;
    }

    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      try {
        const parsed = new URL(normalized);
        if (parsed.pathname.startsWith('/uploads/user-icons/')) {
          return parsed.pathname;
        }
      } catch {
        return normalized;
      }
    }

    return normalized;
  }

  private async persistUserIconDataUrl(dataUrl: string): Promise<string> {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
    if (!match) {
      throw new BadRequestException('Geçersiz ikon verisi');
    }

    const mimeType = match[1].trim().toLowerCase();
    const extension = this.imageMimeToExtension(mimeType);
    if (!extension) {
      throw new BadRequestException('Sadece PNG, JPG veya GIF ikon yüklenebilir');
    }

    const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    if (!buffer.length || buffer.length > maxFlashNickBytes) {
      throw new BadRequestException('İkon dosyası çok büyük veya boş');
    }

    const digest = createHash('sha256').update(buffer).digest('hex');
    const fileName = `${digest}-${randomUUID()}.${extension}`;
    const relativePath = path.join('uploads', 'user-icons', fileName);
    const fullPath = path.join(process.cwd(), relativePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return `/${relativePath.replace(/\\/g, '/')}`;
  }

  private imageMimeToExtension(mimeType: string): string | null {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
    };

    return extensions[mimeType] ?? null;
  }

  private async removeReplacedUserIconFile(
    previousIcon?: string | null,
    nextIcon?: string | null,
  ): Promise<void> {
    if (!previousIcon || previousIcon === nextIcon) return;

    const normalizedPrevious = previousIcon.trim();
    if (!normalizedPrevious.startsWith('/uploads/user-icons/')) return;

    const relativePath = normalizedPrevious.replace(/^\/+/, '');
    const fullPath = path.resolve(process.cwd(), relativePath);
    const uploadRoot = path.resolve(process.cwd(), 'uploads', 'user-icons');
    if (!fullPath.startsWith(`${uploadRoot}${path.sep}`)) return;

    try {
      await fs.unlink(fullPath);
    } catch {
      // Missing old files should not block a profile update.
    }
  }

  async updateStatusMode(userId: number, statusModeId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const statusMode = await this.statusModeService.findOne(statusModeId);
    if (statusMode.name === 'Çatıda' && (user.role?.starCount ?? 0) < 1) {
      throw new ForbiddenException('Çatı modu için en az 1 yıldız gerekir.');
    }

    user.statusMode = statusMode;
    user.statusModeId = statusMode.id;

    await this.userRepository.save(user);

    return this.getUserWithRelations(userId);
  }

  async updateChatPreferences(
    userId: number,
    chatPreferences: Partial<ChatPreferences>,
  ): Promise<User> {
    const patchPayload = { ...(chatPreferences ?? {}) };

    if (Array.isArray(patchPayload.ignoredUsernames)) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'username'],
      });
      if (!user) {
        throw new NotFoundException('Kullanıcı bulunamadı');
      }
      const normalizedSelfUsername = user.username.trim().toLowerCase();
      const normalizedIgnoredUsernames = Array.from(
        new Set(
          patchPayload.ignoredUsernames
            .map((value) =>
              String(value || '')
                .trim()
                .toLowerCase(),
            )
            .filter(
              (value) => value.length > 0 && value !== normalizedSelfUsername,
            ),
        ),
      );
      patchPayload.ignoredUsernames = normalizedIgnoredUsernames;
    }

    const result = await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        chatPreferences: () =>
          `COALESCE("chatPreferences", '{}'::jsonb) || :chatPreferences::jsonb`,
      })
      .where('id = :id', { id: userId })
      .setParameters({
        chatPreferences: JSON.stringify(patchPayload),
      })
      .execute();

    if (!result.affected) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    return this.getUserWithRelations(userId);
  }

  async updateUsername(userId: number, username: string): Promise<User> {
    const existing = await this.findMemberByUsername(username);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Username already exists');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const starCount = user.role?.starCount ?? 0;
    if (starCount >= 1 && starCount <= 24) {
      const settings = await this.systemSettingsRepository?.findOne({
        where: { id: 1 },
      });

      if (!settings?.staffCanChangeNickname) {
        throw new ForbiddenException(
          'Yetkililerin rumuz değiştirmesi sistem ayarlarında kapalı.',
        );
      }
    }

    await this.userRepository.softDelete({ username, isGuest: true });

    user.username = username;
    await this.userRepository.save(user);

    return this.getUserWithRelations(userId);
  }

  async freezeOwnAccount(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    if (user.isGuest) {
      throw new ForbiddenException('Misafir hesap dondurulamaz');
    }

    user.accountFrozen = true;
    user.accountFrozenAt = new Date();
    user.accountFrozenByStarCount = user.role?.starCount ?? 0;

    await this.userRepository.update(userId, {
      accountFrozen: user.accountFrozen,
      accountFrozenAt: user.accountFrozenAt,
      accountFrozenByStarCount: user.accountFrozenByStarCount,
    });

    return this.getUserWithRelations(userId);
  }

  async updateUserByAdmin(
    adminId: number,
    targetUserId: number,
    updateUserByAdminDto: UpdateUserByAdminDto,
  ): Promise<User> {
    const hasPermissionsOverride = Object.prototype.hasOwnProperty.call(
      updateUserByAdminDto,
      'permissions',
    );
    const hasFlashNickOverride = Object.prototype.hasOwnProperty.call(
      updateUserByAdminDto,
      'flashNick',
    );
    const hasAccountFrozenOverride = Object.prototype.hasOwnProperty.call(
      updateUserByAdminDto,
      'accountFrozen',
    );

    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ['role'],
    });

    if (!targetUser) {
      throw new NotFoundException('Düzenlenecek kullanıcı bulunamadı');
    }

    if (
      isProtectedActionBlocked({
        actorStarCount: admin.role.starCount,
        targetProtection: targetUser.protection,
        targetProtectedByStarCount: targetUser.protectedByStarCount,
      })
    ) {
      throw new ForbiddenException(
        'Bu kullanıcı korunuyor. Yalnızca koruyan yetkiliden daha üstün veya eş değer bir yetkili düzenleyebilir.',
      );
    }

    const targetStarCount = targetUser.role?.starCount ?? 0;

    let resultingStarCount = targetStarCount;

    if (
      updateUserByAdminDto.username &&
      updateUserByAdminDto.username !== targetUser.username
    ) {
      const existingUser = await this.findMemberByUsername(
        updateUserByAdminDto.username,
      );
      if (existingUser && existingUser.id !== targetUserId) {
        throw new ConflictException('Username already exists');
      }
      await this.userRepository.softDelete({
        username: updateUserByAdminDto.username,
        isGuest: true,
      });
      targetUser.username = updateUserByAdminDto.username;
    }

    if (updateUserByAdminDto.password) {
      targetUser.password = await bcrypt.hash(
        updateUserByAdminDto.password,
        10,
      );
    }

    if (updateUserByAdminDto.gender) {
      targetUser.gender = updateUserByAdminDto.gender;
    }

    if (updateUserByAdminDto.roleId !== undefined) {
      const newRole = await this.roleRepository.findOne({
        where: { id: updateUserByAdminDto.roleId },
      });

      if (!newRole) {
        throw new NotFoundException('Rol bulunamadı');
      }

      targetUser.role = newRole;
      targetUser.roleId = newRole.id;
      resultingStarCount = newRole.starCount;
      targetUser.permissions = this.convertPermissions(newRole.permissions);
    }

    if (updateUserByAdminDto.protection !== undefined) {
      const oldProtection = targetUser.protection;
      targetUser.protection = updateUserByAdminDto.protection;
      if (targetUser.protection && !oldProtection) {
        // Protection is being enabled
        targetUser.protectedByStarCount = admin.role.starCount;
      } else if (!targetUser.protection) {
        // Protection is being disabled
        targetUser.protectedByStarCount = 0;
      }
    }

    if (updateUserByAdminDto.membershipExpiresAt !== undefined) {
      targetUser.membershipExpiresAt = updateUserByAdminDto.membershipExpiresAt
        ? new Date(updateUserByAdminDto.membershipExpiresAt)
        : null;
    }

    if (hasPermissionsOverride) {
      targetUser.permissions = updateUserByAdminDto.permissions ?? [];
    }

    if (hasFlashNickOverride) {
      targetUser.flashNick = this.normalizeFlashNick(updateUserByAdminDto.flashNick);
    }

    if (hasAccountFrozenOverride) {
      targetUser.accountFrozen = updateUserByAdminDto.accountFrozen === true;
      targetUser.accountFrozenAt = targetUser.accountFrozen ? new Date() : null;
      targetUser.accountFrozenByStarCount = targetUser.accountFrozen
        ? admin.role.starCount
        : 0;
    }

    if (
      !this.hasPermissionInList(
        targetUser.permissions,
        PERMISSION_LABELS.JOIN_EFFECT_SELECT,
      )
    ) {
      targetUser.joinEffect = null;
    }

    if (admin.role.starCount <= resultingStarCount) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    const persistencePatch: Partial<User> = {};
    if (updateUserByAdminDto.username !== undefined) {
      persistencePatch.username = targetUser.username;
    }
    if (updateUserByAdminDto.password) {
      persistencePatch.password = targetUser.password;
    }
    if (updateUserByAdminDto.gender) {
      persistencePatch.gender = targetUser.gender;
    }
    if (updateUserByAdminDto.roleId !== undefined) {
      persistencePatch.roleId = targetUser.roleId;
      persistencePatch.permissions = targetUser.permissions;
    } else if (hasPermissionsOverride) {
      persistencePatch.permissions = targetUser.permissions;
    }
    if (updateUserByAdminDto.protection !== undefined) {
      persistencePatch.protection = targetUser.protection;
      persistencePatch.protectedByStarCount = targetUser.protectedByStarCount;
    }
    if (updateUserByAdminDto.membershipExpiresAt !== undefined) {
      persistencePatch.membershipExpiresAt = targetUser.membershipExpiresAt;
    }
    if (hasFlashNickOverride) {
      persistencePatch.flashNick = targetUser.flashNick;
    }
    if (hasAccountFrozenOverride) {
      persistencePatch.accountFrozen = targetUser.accountFrozen;
      persistencePatch.accountFrozenAt = targetUser.accountFrozenAt;
      persistencePatch.accountFrozenByStarCount =
        targetUser.accountFrozenByStarCount;
    }
    if (targetUser.joinEffect === null) {
      persistencePatch.joinEffect = null;
    }

    if (Object.keys(persistencePatch).length > 0) {
      await this.userRepository.update(targetUserId, persistencePatch);
    }

    return this.getUserWithRelations(targetUserId);
  }

  async deleteUserByAdmin(
    adminId: number,
    targetUserId: number,
  ): Promise<void> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      relations: ['role'],
    });

    if (!admin || !admin.role) {
      throw new ForbiddenException('Kullanıcı bilgileri veya rolü bulunamadı');
    }

    if (admin.role.starCount < 1) {
      throw new ForbiddenException('En az 1 yıldız gereklidir');
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ['role'],
    });

    if (!targetUser) {
      throw new NotFoundException('Silinecek kullanıcı bulunamadı');
    }

    if (
      isProtectedActionBlocked({
        actorStarCount: admin.role.starCount,
        targetProtection: targetUser.protection,
        targetProtectedByStarCount: targetUser.protectedByStarCount,
      })
    ) {
      throw new ForbiddenException(
        'Bu kullanıcı korunuyor. Yalnızca koruyan yetkiliden daha üstün veya eş değer bir yetkili silebilir.',
      );
    }

    const targetStarCount = targetUser.role?.starCount ?? 0;

    if (admin.role.starCount <= targetStarCount) {
      throw new ForbiddenException(ACTION_NOT_ALLOWED_MESSAGE);
    }

    await this.userRepository.softDelete(targetUserId);
  }

  async updateLastLoginAt(userId: number): Promise<void> {
    await this.userRepository.update(userId, {
      lastLoginAt: new Date(),
    });
  }

  async updateFontName(userId: number, fontName: string | null): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const normalizedFontName =
      typeof fontName === 'string' && fontName.trim().length > 0
        ? fontName.trim()
        : null;

    user.fontName = normalizedFontName;

    await this.userRepository.save(user);

    return this.getUserWithRelations(userId);
  }

  async updateGranite(userId: number, granite: string | null): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const normalizedGranite =
      typeof granite === 'string' && granite.trim().length > 0
        ? granite.trim()
        : null;

    user.granite = normalizedGranite;

    await this.userRepository.save(user);

    return this.getUserWithRelations(userId);
  }

  async updateNickColor(
    userId: number,
    nickColor: string | null,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const normalizedNickColor =
      typeof nickColor === 'string' && nickColor.trim().length > 0
        ? nickColor.trim()
        : null;

    user.nickColor = normalizedNickColor;

    await this.userRepository.save(user);

    return this.getUserWithRelations(userId);
  }

  async updateUserGif(userId: number, userGif: string | null): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    let normalizedUserGif: string | null = null;
    if (typeof userGif === 'string' && userGif.trim().length > 0) {
      const trimmed = userGif.trim();
      const rawFileName = trimmed.startsWith('/usergifler/')
        ? trimmed.replace('/usergifler/', '')
        : trimmed;
      const fileName = legacyUserGifAliases[rawFileName] ?? rawFileName;

      if (!allowedUserGifFiles.some((item) => item === fileName)) {
        throw new BadRequestException('Geçersiz user gif seçimi');
      }

      normalizedUserGif = `/usergifler/${fileName}`;
    }

    user.userGif = normalizedUserGif;

    await this.userRepository.save(user);

    return this.getUserWithRelations(userId);
  }

  async updateFlashNick(
    userId: number,
    flashNick: string | null,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    user.flashNick = this.normalizeFlashNick(flashNick);

    await this.userRepository.save(user);

    return this.getUserWithRelations(userId);
  }

  async updateJoinEffect(
    userId: number,
    joinEffect: JoinEffect | null,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const isRootUser =
      String(user.username || '').trim().toLocaleLowerCase('tr-TR') === 'root';
    const hasJoinEffectPermission = hasPermissionForUser(
      user,
      PERMISSION_LABELS.JOIN_EFFECT_SELECT,
    );

    if (!isRootUser && user.isGuest) {
      throw new ForbiddenException('Bu özellik için yetkiniz yok');
    }
    if (!isRootUser && !hasJoinEffectPermission) {
      throw new ForbiddenException('Giriş efekti seçme yetkiniz yok.');
    }

    const normalizedJoinEffect =
      typeof joinEffect === 'string' && joinEffect.trim().length > 0
        ? (joinEffect.trim() as JoinEffect)
        : null;

    if (
      normalizedJoinEffect !== null &&
      !allowedJoinEffects.includes(normalizedJoinEffect)
    ) {
      throw new BadRequestException('Geçersiz giriş efekti');
    }

    user.joinEffect = normalizedJoinEffect;
    await this.userRepository.save(user);

    return this.getUserWithRelations(userId);
  }
}
