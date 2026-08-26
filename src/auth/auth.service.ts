import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CheckUsernameDto } from './dto/check-username.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CheckUsernameResponseDto } from './dto/check-username-response.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GuestDto } from './dto/guest.dto';
import { GuestResponseDto } from './dto/guest-response.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginHistoryService } from '../settings/login-history.service';
import { ForbiddenNicknamesService } from '../settings/forbidden-nicknames.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { SecuritySettingsService } from '../settings/security-settings.service';
import { IpLookupService } from '../settings/ip-lookup.service';
import { ModerationService } from '../moderation/moderation.service';
import { defaultChatPreferences } from '../user/chat-preferences.constants';
import { GuestCleanupService } from '../user/guest-cleanup.service';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

//TODOS
// Sonraki Adımlar
// Rate limiting eklenebilir
// Unit testler yazılabilir
// Swagger/OpenAPI dokümantasyonu eklenebilir
// Password reset özelliği eklenebilir

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly turkishRegionNames = new Intl.DisplayNames(['tr'], {
    type: 'region',
  });
  private readonly failedAttemptWindowMs = 5 * 60 * 1000;
  private readonly failedAttemptThreshold = 15;
  private readonly failedAttemptsByIp = new Map<
    string,
    { count: number; firstAttemptAt: number }
  >();

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly loginHistoryService: LoginHistoryService,
    private readonly forbiddenNicknamesService: ForbiddenNicknamesService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly securitySettingsService: SecuritySettingsService,
    private readonly ipLookupService: IpLookupService,
    private readonly moderationService: ModerationService,
    private readonly guestCleanupService: GuestCleanupService,
  ) {}

  private triggerGuestCleanup(): void {
    try {
      this.guestCleanupService.runIfDue().catch(() => undefined);
    } catch {
      // Cleanup failures should never break auth flows.
    }
  }

  private buildAuthPayload(user: {
    id: number;
    username: string;
    isGuest?: boolean;
  }) {
    return {
      sub: user.id,
      username: user.username,
      isGuest: user.isGuest === true,
    };
  }

  private isRootUsername(username?: string | null): boolean {
    return (
      String(username ?? '')
        .trim()
        .toLocaleLowerCase('tr-TR') === 'root'
    );
  }

  private isRoleDebugEnabled(): boolean {
    return process.env.ROLE_DEBUG_LOGS === 'true';
  }

  private logRoleDebug(
    event: string,
    payload: Record<string, unknown>,
  ): void {
    if (!this.isRoleDebugEnabled()) return;
    this.logger.log(
      `[ROLE_DEBUG] ${event} ${JSON.stringify(payload, null, 2)}`,
    );
  }

  async checkUsername(
    checkUsernameDto: CheckUsernameDto,
  ): Promise<CheckUsernameResponseDto> {
    this.triggerGuestCleanup();
    const existingMember =
      await this.userService.findMemberByUsernameCaseInsensitive(
        checkUsernameDto.username,
      );
    const exists = !!existingMember;

    return {
      available: !exists,
      message: exists
        ? `"${existingMember?.username}" kullanıcı adı zaten alınmış`
        : 'Kullanıcı adı kullanılabilir',
      existingUsername: exists ? existingMember?.username : undefined,
    };
  }

  async login(loginDto: LoginDto, req?: any): Promise<AuthResponseDto> {
    this.triggerGuestCleanup();
    const ipAddress = req ? this.extractIpAddress(req) : 'unknown';
    const isRootLoginAttempt = this.isRootUsername(loginDto.username);

    if (!isRootLoginAttempt) {
      await this.ensureIpNotFloodBanned(ipAddress);
    }

    try {
      // Check if login is allowed
      const settings = await this.systemSettingsService.getSettings();
      if (!settings.everyoneCanEnter && !isRootLoginAttempt) {
        throw new ForbiddenException('Giriş şu anda kapalıdır');
      }
      this.ensureDeviceLoginEnabled(settings, req, isRootLoginAttempt);

      // Check if country is blocked
      if (req && !isRootLoginAttempt) {
        await this.checkCountryBlocked(ipAddress);
      }

      // Check if VPN/proxy is blocked
      if (req && !isRootLoginAttempt) {
        await this.checkVpnBlocked(ipAddress);
      }

      const user = await this.userService.validateUser(
        loginDto.username,
        loginDto.password,
      );

      if (!user) {
        throw new UnauthorizedException('Invalid username or password');
      }

      const normalizedAgentNickname = String(loginDto.agentNickname ?? '').trim();
      const normalizedUsername = String(user.username ?? '')
        .trim()
        .toLocaleLowerCase('tr-TR');
      const isRootUser = normalizedUsername === 'root';
      if (
        normalizedAgentNickname &&
        !isRootUser &&
        !hasPermissionForUser(user, PERMISSION_LABELS.SECRET_NICKNAME_LOGIN)
      ) {
        throw new ForbiddenException('Gizli rumuz girişi yetkiniz yok.');
      }

      if (!isRootUser) {
        await this.moderationService.ensureUserNotBanned(user.id);
      }

      const payload = this.buildAuthPayload(user);

      const accessToken = await this.jwtService.signAsync(payload);

      // Update last login time
      await this.userService.updateLastLoginAt(user.id);

      // Save login history
      let loginHistoryId: number | undefined;
      if (req) {
        const userAgent = String(req.headers['user-agent'] || 'unknown');
        const browser = this.extractBrowserInfo(userAgent);
        const device = this.extractDeviceInfo(userAgent);
        const role = user.role?.name || 'User';

        const loginHistory = await this.loginHistoryService.saveLoginHistory({
          userId: user.id,
          username: user.username,
          agentNickname: loginDto.agentNickname?.trim() || null,
          role,
          starCount: user.role?.starCount ?? 0,
          ipAddress,
          browser,
          device,
          gender: user.gender,
        });
        loginHistoryId = loginHistory.id;
      }

      this.clearFailedAttempts(ipAddress);

      return {
        id: user.id,
        accessToken,
        username: user.username,
        gender: user.gender,
        frame: user.frame,
        createdAt: user.createdAt,
        loginHistoryId,
      };
    } catch (error) {
      await this.registerFailedAttempt(ipAddress);
      throw error;
    }
  }

  private extractIpAddress(req: any): string {
    // Check for proxy headers first (common in production with load balancers/reverse proxies)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // x-forwarded-for can contain multiple IPs, get the first one (client IP)
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    // Fallback to direct connection IP
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  private extractBrowserInfo(userAgent: string): string {
    if (userAgent === 'unknown') return 'Unknown';

    // Chrome (must check before Safari as Chrome UA contains Safari)
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      const match = userAgent.match(/Chrome\/([\d.]+)/);
      return match ? `Chrome ${match[1].split('.')[0]}` : 'Chrome';
    }

    // Edge
    if (userAgent.includes('Edg')) {
      const match = userAgent.match(/Edg\/([\d.]+)/);
      return match ? `Edge ${match[1].split('.')[0]}` : 'Edge';
    }

    // Firefox
    if (userAgent.includes('Firefox')) {
      const match = userAgent.match(/Firefox\/([\d.]+)/);
      return match ? `Firefox ${match[1].split('.')[0]}` : 'Firefox';
    }

    // Safari (must check after Chrome/Edge)
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      const match = userAgent.match(/Version\/([\d.]+)/);
      return match ? `Safari ${match[1].split('.')[0]}` : 'Safari';
    }

    // Opera
    if (userAgent.includes('OPR') || userAgent.includes('Opera')) {
      const match = userAgent.match(/(?:OPR|Opera)\/([\d.]+)/);
      return match ? `Opera ${match[1].split('.')[0]}` : 'Opera';
    }

    // Internet Explorer
    if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
      return 'Internet Explorer';
    }

    return 'Other';
  }

  private extractDeviceInfo(userAgent: string): string {
    if (userAgent.includes('Mobile')) {
      return 'Mobile';
    } else if (userAgent.includes('Tablet')) {
      return 'Tablet';
    } else {
      return 'Desktop';
    }
  }

  private isMobileUserAgent(userAgent: string): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Windows Phone/i.test(
      userAgent,
    );
  }

  private ensureDeviceLoginEnabled(
    settings: { desktopLoginEnabled?: boolean; mobileLoginEnabled?: boolean },
    req?: any,
    allowBypass = false,
  ): void {
    if (allowBypass) {
      return;
    }

    const userAgent = String(req?.headers?.['user-agent'] || '');
    const isMobile = this.isMobileUserAgent(userAgent);

    if (isMobile) {
      if (settings.mobileLoginEnabled === false) {
        throw new ForbiddenException('Mobil girişler kapalıdır');
      }
      return;
    }

    if (settings.desktopLoginEnabled === false) {
      throw new ForbiddenException('Masaüstü tarayıcı girişleri kapalıdır');
    }
  }

  private normalizeCountryValue(value: string | null | undefined): string | null {
    const normalized = String(value ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('tr-TR');

    return normalized.length > 0 ? normalized : null;
  }

  private async getCountryMetadataFromIp(ipAddress: string): Promise<{
    country: string | null;
    countryCode: string | null;
    localizedCountry: string | null;
  }> {
    if (!ipAddress || ipAddress === 'unknown') {
      return {
        country: null,
        countryCode: null,
        localizedCountry: null,
      };
    }

    const geo = await this.ipLookupService.lookup(ipAddress);
    const country =
      geo.country && geo.country !== 'Bilinmiyor' ? geo.country : null;
    const countryCode =
      geo.countryCode && geo.countryCode !== 'Bilinmiyor'
        ? geo.countryCode.toUpperCase()
        : null;
    const localizedCountry = countryCode
      ? this.turkishRegionNames.of(countryCode) ?? null
      : null;

    return {
      country,
      countryCode,
      localizedCountry,
    };
  }

  private readonly knownVpnIspKeywords = [
    'cloudflare',
    'nordvpn',
    'expressvpn',
    'surfshark',
    'mullvad',
    'protonvpn',
    'ipvanish',
    'cyberghost',
    'windscribe',
    'tunnelbear',
    'privateinternetaccess',
    'hotspot shield',
    'vyprvpn',
    'torguard',
    'strongvpn',
    'zenmate',
    'hidemyass',
  ];

  private isKnownVpnIsp(isp: string | null | undefined): boolean {
    if (!isp || isp === 'Bilinmiyor') return false;
    const lower = isp.toLowerCase();
    return this.knownVpnIspKeywords.some((keyword) => lower.includes(keyword));
  }

  private async checkVpnBlocked(ipAddress: string): Promise<void> {
    const securitySettings = await this.securitySettingsService.getSettings();

    if (!securitySettings.vpnBlockEnabled) {
      return;
    }

    const geo = await this.ipLookupService.lookup(ipAddress);
    if (
      geo.isProxy === true ||
      geo.isHosting === true ||
      this.isKnownVpnIsp(geo.isp)
    ) {
      throw new ForbiddenException(
        'VPN veya proxy bağlantısıyla giriş yapamazsınız.',
      );
    }
  }

  private async checkCountryBlocked(ipAddress: string): Promise<void> {
    const securitySettings = await this.securitySettingsService.getSettings();

    if (!securitySettings.countryBlockEnabled) {
      return;
    }

    const { country, countryCode, localizedCountry } =
      await this.getCountryMetadataFromIp(ipAddress);
    this.logger.log(
      `Detected country for ${ipAddress}: ${
        countryCode || localizedCountry || country || 'unknown'
      }`,
    );

    const blockedCountries = new Set(
      (securitySettings.blockedCountries ?? [])
        .map((value) => this.normalizeCountryValue(value))
        .filter((value): value is string => Boolean(value)),
    );
    const candidates = [countryCode, country, localizedCountry]
      .map((value) => this.normalizeCountryValue(value))
      .filter((value): value is string => Boolean(value));

    if (candidates.some((candidate) => blockedCountries.has(candidate))) {
      throw new ForbiddenException('Bu ülkeden girişler kapalı');
    }
  }

  async register(
    registerDto: RegisterDto,
    req?: any,
  ): Promise<AuthResponseDto> {
    this.triggerGuestCleanup();
    const ipAddress = req ? this.extractIpAddress(req) : 'unknown';

    await this.ensureIpNotFloodBanned(ipAddress);

    try {
      // Check if everyone can enter
      const settings = await this.systemSettingsService.getSettings();
      if (!settings.everyoneCanEnter) {
        throw new ForbiddenException('Giriş şu anda kapalıdır');
      }
      this.ensureDeviceLoginEnabled(settings, req);

      // Check if new registration is enabled
      if (!settings.newRegistrationEnabled) {
        throw new ForbiddenException('Yeni kayıtlar kapalıdır');
      }

      // Check if country is blocked
      if (req) {
        await this.checkCountryBlocked(ipAddress);
      }

      // Check if VPN/proxy is blocked
      if (req) {
        await this.checkVpnBlocked(ipAddress);
      }

      await this.ensureNicknameAllowed(registerDto.username);

      const user = await this.userService.create(
        registerDto.username,
        registerDto.password,
        registerDto.gender,
      );

      const payload = this.buildAuthPayload(user);

      const accessToken = await this.jwtService.signAsync(payload);
      this.clearFailedAttempts(ipAddress);

      return {
        id: user.id,
        accessToken,
        username: user.username,
        gender: user.gender,
        frame: user.frame,
        createdAt: user.createdAt,
      };
    } catch (error) {
      await this.registerFailedAttempt(ipAddress);
      throw error;
    }
  }

  async guest(guestDto: GuestDto, req?: any): Promise<GuestResponseDto> {
    this.triggerGuestCleanup();
    const ipAddress = req ? this.extractIpAddress(req) : 'unknown';

    await this.ensureIpNotFloodBanned(ipAddress);

    try {
      // Check if everyone can enter
      const settings = await this.systemSettingsService.getSettings();
      if (!settings.everyoneCanEnter) {
        throw new ForbiddenException('Giriş şu anda kapalıdır');
      }
      this.ensureDeviceLoginEnabled(settings, req);

      // Check if guest login is enabled
      if (!settings.guestLoginEnabled) {
        throw new ForbiddenException('Misafir girişleri kapalıdır');
      }

      // Check if guest system is enabled
      const securitySettings = await this.securitySettingsService.getSettings();
      if (!securitySettings.guestSystemEnabled) {
        throw new ForbiddenException('Misafir girişi kapalı');
      }

      // Check if country is blocked
      if (req) {
        await this.checkCountryBlocked(ipAddress);
      }

      // Check if VPN/proxy is blocked
      if (req) {
        await this.checkVpnBlocked(ipAddress);
      }

      await this.ensureNicknameAllowed(guestDto.username);

      const guestUser = await this.userService.createOrRefreshGuest(
        guestDto.username,
        guestDto.gender,
      );
      const payload = this.buildAuthPayload(guestUser);
      const accessToken = await this.jwtService.signAsync(payload);

      const userAgent = String(req?.headers?.['user-agent'] || 'unknown');
      const browser = this.extractBrowserInfo(userAgent);
      const device = this.extractDeviceInfo(userAgent);

      const loginHistory = await this.loginHistoryService.saveLoginHistory({
        userId: guestUser.id,
        username: guestUser.username,
        role: 'Guest',
        starCount: 0,
        ipAddress,
        browser,
        device,
        gender: guestUser.gender,
      });

      this.clearFailedAttempts(ipAddress);

      return {
        id: guestUser.id,
        accessToken,
        username: guestUser.username,
        gender: guestUser.gender,
        isGuest: true,
        loginHistoryId: loginHistory.id,
      };
    } catch (error) {
      await this.registerFailedAttempt(ipAddress);
      throw error;
    }
  }

  private async ensureNicknameAllowed(nickname: string): Promise<void> {
    const banned =
      await this.forbiddenNicknamesService.findByNickname(nickname);
    if (banned) {
      throw new ForbiddenException('Bu nick yasaklı');
    }
  }

  private async ensureIpNotFloodBanned(ipAddress: string): Promise<void> {
    const isBlocked = await this.securitySettingsService.hasActiveFloodBan(
      ipAddress,
    );
    if (isBlocked) {
      throw new ForbiddenException(
        'Giriş denemeniz geçici olarak engellendi. Lütfen daha sonra tekrar deneyin.',
      );
    }
  }

  private clearFailedAttempts(ipAddress: string): void {
    const normalizedIp = String(ipAddress ?? '').trim();
    if (!normalizedIp) return;
    this.failedAttemptsByIp.delete(normalizedIp);
  }

  private async registerFailedAttempt(ipAddress: string): Promise<void> {
    const normalizedIp = String(ipAddress ?? '').trim();
    if (!normalizedIp || normalizedIp === 'unknown') {
      return;
    }

    const now = Date.now();
    const current = this.failedAttemptsByIp.get(normalizedIp);

    if (!current || now - current.firstAttemptAt > this.failedAttemptWindowMs) {
      this.failedAttemptsByIp.set(normalizedIp, {
        count: 1,
        firstAttemptAt: now,
      });
      return;
    }

    const next = { ...current, count: current.count + 1 };
    this.failedAttemptsByIp.set(normalizedIp, next);

    if (next.count < this.failedAttemptThreshold) {
      return;
    }

    await this.securitySettingsService.createOrRefreshFloodBan({
      ipAddress: normalizedIp,
      reason: 'Sunucu flood koruması',
      source: 'server_flood',
      durationHours: 24,
      metadata: {
        failedAttempts: next.count,
        firstAttemptAt: new Date(next.firstAttemptAt).toISOString(),
      },
    });

    this.failedAttemptsByIp.delete(normalizedIp);
  }

  async getMe(userId: number): Promise<MeResponseDto> {
    this.triggerGuestCleanup();
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isGuest) {
      await this.userService.touchGuestExpiry(user.id);
    }

    this.logRoleDebug('auth:getMe', {
      joinEffectAuthorized: hasPermissionForUser(
        user,
        PERMISSION_LABELS.JOIN_EFFECT_SELECT,
      ),
      userId: user.id,
      username: user.username,
      isGuest: user.isGuest === true,
      roleId: user.role?.id ?? user.roleId ?? null,
      roleName: user.role?.name ?? null,
      roleStarCount: user.role?.starCount ?? null,
      roleStarColor: user.role?.starColor ?? null,
      roleIcon: user.role?.icon ?? null,
      permissions: user.permissions ?? [],
    });

    return {
      id: user.id,
      username: user.username,
      isGuest: user.isGuest === true,
      gender: user.gender,
      frame: user.isGuest === true ? null : user.frame,
      icon: user.isGuest === true ? null : user.icon,
      fontName: user.fontName,
      granite: user.granite,
      nickColor: user.nickColor,
      userGif: user.userGif,
      flashNick: user.flashNick,
      accountFrozen: user.accountFrozen,
      joinEffect: hasPermissionForUser(user, PERMISSION_LABELS.JOIN_EFFECT_SELECT)
        ? user.joinEffect
        : null,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
            microphoneDuration: user.role.microphoneDuration,
            starColor: user.role.starColor,
            starCount: user.role.starCount,
            icon: user.role.icon,
            permissions: user.role.permissions,
          }
        : null,
      permissions: user.permissions ?? [],
      statusMode: user.statusMode
        ? {
            id: user.statusMode.id,
            name: user.statusMode.name,
          }
        : null,
      createdAt: user.createdAt,
      micBanned: user.micBanned || false,
      cameraBanned: user.cameraBanned || false,
      globalMuted: user.globalMuted || false,
      chatPreferences: {
        ...defaultChatPreferences,
        ...(user.chatPreferences ?? {}),
      },
    };
  }

  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;
    await this.userService.changePassword(userId, currentPassword, newPassword);
  }
}
