import { AuthService } from './auth.service';
import { Gender } from '../common/enums/gender.enum';

describe('AuthService', () => {
  const createDeps = () => {
    const userService = {
      cleanupExpiredGuests: jest.fn(),
      findMemberByUsername: jest.fn(),
      findMemberByUsernameCaseInsensitive: jest.fn(),
      validateUser: jest.fn(),
      create: jest.fn(),
      createOrRefreshGuest: jest.fn(),
      updateLastLoginAt: jest.fn(),
      findById: jest.fn(),
      touchGuestExpiry: jest.fn(),
    };

    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('token'),
    };

    const loginHistoryService = {
      saveLoginHistory: jest.fn().mockResolvedValue({ id: 99 }),
    };

    const forbiddenNicknamesService = {
      findByNickname: jest.fn(),
    };

    const systemSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        everyoneCanEnter: true,
        desktopLoginEnabled: true,
        mobileLoginEnabled: true,
        newRegistrationEnabled: true,
        guestLoginEnabled: true,
      }),
    };

    const securitySettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        countryBlockEnabled: false,
        guestSystemEnabled: true,
      }),
      hasActiveFloodBan: jest.fn().mockResolvedValue(false),
    };

    const ipLookupService = {
      lookup: jest.fn().mockResolvedValue({
        ipAddress: '1.2.3.4',
        city: 'Bilinmiyor',
        district: 'Bilinmiyor',
        country: 'United States',
        countryCode: 'US',
        isp: 'Bilinmiyor',
        regionName: 'Bilinmiyor',
      }),
    };

    const moderationService = {
      ensureUserNotBanned: jest.fn(),
    };

    const guestCleanupService = {
      runIfDue: jest.fn().mockResolvedValue(undefined),
    };

    return {
      userService,
      jwtService,
      loginHistoryService,
      forbiddenNicknamesService,
      systemSettingsService,
      securitySettingsService,
      ipLookupService,
      moderationService,
      guestCleanupService,
    };
  };

  it('checkUsername should trigger throttled cleanup and not call direct cleanup', async () => {
    const deps = createDeps();
    deps.userService.findMemberByUsernameCaseInsensitive.mockResolvedValue({
      username: 'kaanx',
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    const result = await service.checkUsername({ username: 'KaanX' });

    expect(deps.guestCleanupService.runIfDue).toHaveBeenCalledTimes(1);
    expect(deps.userService.cleanupExpiredGuests).not.toHaveBeenCalled();
    expect(
      deps.userService.findMemberByUsernameCaseInsensitive,
    ).toHaveBeenCalledWith('KaanX');
    expect(result).toEqual(
      expect.objectContaining({
        available: false,
        existingUsername: 'kaanx',
      }),
    );
  });

  it('login should trigger throttled cleanup and not call direct cleanup', async () => {
    const deps = createDeps();
    deps.userService.validateUser.mockResolvedValue({
      id: 1,
      username: 'kaanx',
      gender: 'male',
      role: { name: 'User' },
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    const result = await service.login({
      username: 'KaanX',
      password: 'secret',
    });

    expect(deps.guestCleanupService.runIfDue).toHaveBeenCalledTimes(1);
    expect(deps.userService.cleanupExpiredGuests).not.toHaveBeenCalled();
    expect(deps.userService.validateUser).toHaveBeenCalledWith(
      'KaanX',
      'secret',
    );
    expect(result).toEqual(
      expect.objectContaining({
        username: 'kaanx',
        loginHistoryId: undefined,
      }),
    );
  });

  it('login should return loginHistoryId when request is provided', async () => {
    const deps = createDeps();
    deps.userService.validateUser.mockResolvedValue({
      id: 7,
      username: 'kaanx',
      gender: 'male',
      frame: null,
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      role: { name: 'Admin', starCount: 2 },
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    const result = await service.login(
      { username: 'kaanx', password: 'secret' },
      {
        headers: { 'user-agent': 'Mozilla/5.0', 'x-forwarded-for': '1.2.3.4' },
      },
    );

    expect(deps.loginHistoryService.saveLoginHistory).toHaveBeenCalled();
    expect(result.loginHistoryId).toBe(99);
  });

  it('login should reject agent nickname when Gizli Rumuz Giriş permission is missing', async () => {
    const deps = createDeps();
    deps.userService.validateUser.mockResolvedValue({
      id: 9,
      username: 'member',
      gender: 'male',
      role: { name: 'User', permissions: {} },
      permissions: [],
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.login({
        username: 'member',
        password: 'secret',
        agentNickname: 'AjanX',
      }),
    ).rejects.toThrow('Gizli rumuz girişi yetkiniz yok.');
  });

  it('login should allow root user with agent nickname without Gizli Rumuz Giriş permission', async () => {
    const deps = createDeps();
    deps.userService.validateUser.mockResolvedValue({
      id: 1,
      username: 'root',
      gender: 'male',
      role: { name: 'Root', permissions: {} },
      permissions: [],
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.login({
        username: 'root',
        password: 'secret',
        agentNickname: 'AjanRoot',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        username: 'root',
        accessToken: 'token',
      }),
    );
  });

  it('login should allow root when site entry is disabled and skip ban checks', async () => {
    const deps = createDeps();
    deps.systemSettingsService.getSettings.mockResolvedValue({
      everyoneCanEnter: false,
      newRegistrationEnabled: true,
      guestLoginEnabled: true,
    });
    deps.userService.validateUser.mockResolvedValue({
      id: 1,
      username: 'root',
      gender: 'male',
      role: { name: 'Root', starCount: 25, permissions: {} },
      permissions: [],
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.login({ username: 'root', password: 'secret' }),
    ).resolves.toEqual(
      expect.objectContaining({
        username: 'root',
        accessToken: 'token',
      }),
    );
    expect(deps.moderationService.ensureUserNotBanned).not.toHaveBeenCalled();
  });

  it('login should let root bypass flood and country blocks while writing login history', async () => {
    const deps = createDeps();
    deps.securitySettingsService.hasActiveFloodBan.mockResolvedValue(true);
    deps.securitySettingsService.getSettings.mockResolvedValue({
      countryBlockEnabled: true,
      blockedCountries: ['US'],
      guestSystemEnabled: true,
    });
    deps.userService.validateUser.mockResolvedValue({
      id: 1,
      username: 'root',
      gender: 'male',
      role: { name: 'Root', starCount: 25, permissions: {} },
      permissions: [],
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    const result = await service.login(
      { username: 'root', password: 'secret' },
      {
        headers: { 'user-agent': 'Mozilla/5.0', 'x-forwarded-for': '1.2.3.4' },
      },
    );

    expect(result.loginHistoryId).toBe(99);
    expect(deps.securitySettingsService.hasActiveFloodBan).not.toHaveBeenCalled();
    expect(deps.ipLookupService.lookup).not.toHaveBeenCalled();
    expect(deps.loginHistoryService.saveLoginHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'root',
        starCount: 25,
      }),
    );
  });

  it('login should reject non-root when site entry is disabled', async () => {
    const deps = createDeps();
    deps.systemSettingsService.getSettings.mockResolvedValue({
      everyoneCanEnter: false,
      newRegistrationEnabled: true,
      guestLoginEnabled: true,
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.login({ username: 'member', password: 'secret' }),
    ).rejects.toThrow('Giriş şu anda kapalıdır');
  });

  it('login should reject desktop browser users when desktop login is disabled', async () => {
    const deps = createDeps();
    deps.systemSettingsService.getSettings.mockResolvedValue({
      everyoneCanEnter: true,
      desktopLoginEnabled: false,
      mobileLoginEnabled: true,
      newRegistrationEnabled: true,
      guestLoginEnabled: true,
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.login(
        { username: 'member', password: 'secret' },
        {
          headers: {
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
            'x-forwarded-for': '1.2.3.4',
          },
        },
      ),
    ).rejects.toThrow('Masaüstü tarayıcı girişleri kapalıdır');
    expect(deps.userService.validateUser).not.toHaveBeenCalled();
  });

  it('login should reject mobile users when mobile login is disabled', async () => {
    const deps = createDeps();
    deps.systemSettingsService.getSettings.mockResolvedValue({
      everyoneCanEnter: true,
      desktopLoginEnabled: true,
      mobileLoginEnabled: false,
      newRegistrationEnabled: true,
      guestLoginEnabled: true,
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.login(
        { username: 'member', password: 'secret' },
        {
          headers: {
            'user-agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
            'x-forwarded-for': '1.2.3.4',
          },
        },
      ),
    ).rejects.toThrow('Mobil girişler kapalıdır');
    expect(deps.userService.validateUser).not.toHaveBeenCalled();
  });

  it('guest should reject desktop browser users when desktop login is disabled', async () => {
    const deps = createDeps();
    deps.systemSettingsService.getSettings.mockResolvedValue({
      everyoneCanEnter: true,
      desktopLoginEnabled: false,
      mobileLoginEnabled: true,
      newRegistrationEnabled: true,
      guestLoginEnabled: true,
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.guest(
        { username: 'misafir', gender: Gender.FEMALE },
        {
          headers: {
            'user-agent': 'Mozilla/5.0',
            'x-forwarded-for': '5.6.7.8',
          },
        },
      ),
    ).rejects.toThrow('Masaüstü tarayıcı girişleri kapalıdır');
    expect(deps.userService.createOrRefreshGuest).not.toHaveBeenCalled();
  });

  it('register should reject desktop browser users when desktop login is disabled', async () => {
    const deps = createDeps();
    deps.systemSettingsService.getSettings.mockResolvedValue({
      everyoneCanEnter: true,
      desktopLoginEnabled: false,
      mobileLoginEnabled: true,
      newRegistrationEnabled: true,
      guestLoginEnabled: true,
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.register(
        { username: 'newbie', password: 'secret', gender: Gender.MALE },
        {
          headers: {
            'user-agent': 'Mozilla/5.0',
            'x-forwarded-for': '5.6.7.8',
          },
        },
      ),
    ).rejects.toThrow('Masaüstü tarayıcı girişleri kapalıdır');
    expect(deps.userService.create).not.toHaveBeenCalled();
  });

  it('guest should return loginHistoryId', async () => {
    const deps = createDeps();
    deps.userService.createOrRefreshGuest = jest.fn().mockResolvedValue({
      id: 13,
      username: 'misafir',
      gender: Gender.FEMALE,
      isGuest: true,
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    const result = await service.guest(
      { username: 'misafir', gender: Gender.FEMALE },
      {
        headers: { 'user-agent': 'Mozilla/5.0', 'x-forwarded-for': '5.6.7.8' },
      },
    );

    expect(result.loginHistoryId).toBe(99);
  });

  it('getMe should trigger throttled cleanup and return current user', async () => {
    const deps = createDeps();
    deps.userService.findById.mockResolvedValue({
      id: 1,
      username: 'member',
      isGuest: false,
      gender: 'male',
      frame: null,
      icon: null,
      fontName: null,
      granite: null,
      flashNick: null,
      joinEffect: null,
      role: null,
      statusMode: null,
      createdAt: new Date(),
      micBanned: false,
      cameraBanned: false,
      chatPreferences: {},
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    const result = await service.getMe(1);

    expect(result.id).toBe(1);
    expect(deps.guestCleanupService.runIfDue).toHaveBeenCalledTimes(1);
    expect(deps.userService.cleanupExpiredGuests).not.toHaveBeenCalled();
  });

  it('login should continue when guest cleanup throws synchronously', async () => {
    const deps = createDeps();
    deps.guestCleanupService.runIfDue.mockImplementation(() => {
      throw new Error('cleanup failed');
    });
    deps.userService.validateUser.mockResolvedValue({
      id: 1,
      username: 'member',
      gender: 'male',
      role: { name: 'User' },
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.login({ username: 'member', password: 'secret' }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 1,
        username: 'member',
        accessToken: 'token',
      }),
    );
  });

  it('login should fail for wrong password even with mixed-case username', async () => {
    const deps = createDeps();
    deps.userService.validateUser.mockResolvedValue(null);

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.login({ username: 'KaanX', password: 'wrong-pass' }),
    ).rejects.toThrow('Invalid username or password');
    expect(deps.userService.validateUser).toHaveBeenCalledWith(
      'KaanX',
      'wrong-pass',
    );
  });

  it('login should block when blockedCountries contains country code', async () => {
    const deps = createDeps();
    deps.securitySettingsService.getSettings.mockResolvedValue({
      countryBlockEnabled: true,
      blockedCountries: ['US'],
      guestSystemEnabled: true,
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.login(
        { username: 'member', password: 'secret' },
        {
          headers: {
            'user-agent': 'Mozilla/5.0',
            'x-forwarded-for': '1.2.3.4',
          },
        },
      ),
    ).rejects.toThrow('Bu ülkeden girişler kapalı');
  });

  it('login should block when blockedCountries contains Turkish country name', async () => {
    const deps = createDeps();
    deps.securitySettingsService.getSettings.mockResolvedValue({
      countryBlockEnabled: true,
      blockedCountries: ['Amerika Birleşik Devletleri'],
      guestSystemEnabled: true,
    });

    const service = new AuthService(
      deps.userService as any,
      deps.jwtService as any,
      deps.loginHistoryService as any,
      deps.forbiddenNicknamesService as any,
      deps.systemSettingsService as any,
      deps.securitySettingsService as any,
      deps.ipLookupService as any,
      deps.moderationService as any,
      deps.guestCleanupService as any,
    );

    await expect(
      service.login(
        { username: 'member', password: 'secret' },
        {
          headers: {
            'user-agent': 'Mozilla/5.0',
            'x-forwarded-for': '1.2.3.4',
          },
        },
      ),
    ).rejects.toThrow('Bu ülkeden girişler kapalı');
  });
});
