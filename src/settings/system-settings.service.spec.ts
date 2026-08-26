import { SystemSettingsService } from './system-settings.service';
import { PERMISSION_LABELS } from '../common/utils/permission.util';

describe('SystemSettingsService root repair', () => {
  const createSystemSettings = (overrides?: Record<string, unknown>) => ({
    id: 1,
    everyoneCanEnter: true,
    desktopLoginEnabled: true,
    mobileLoginEnabled: true,
    guestLoginEnabled: true,
    newRegistrationEnabled: true,
    guestCanWrite: true,
    staffCanChangeNickname: false,
    friendsPrivateMessageMembersOnly: false,
    membersPrivateMessageEnabled: true,
    membersVoiceCallEnabled: true,
    guestPrivateMessageEnabled: true,
    guestVoiceCallEnabled: true,
    firstMessageDelayEnabled: false,
    firstMessageDelaySeconds: 0,
    firstMessageDelayUpdatedAt: null,
    guestWaitSeconds: 0,
    guestWaitUpdatedAt: null,
    memberAndGuestMicDurationSeconds: 0,
    siteLanguage: 'tr',
    chatImageSendPermission: 'EVERYONE',
    chatVoiceSendPermission: 'MEMBERS',
    chatVoiceRecordSendPermission: 'NONE',
    chatYoutubeSendPermission: 'EVERYONE',
    siteName: null,
    siteTitle: null,
    siteDescription: null,
    homePageHtml: null,
    welcomeMessageTemplate: null,
    activeLoginDesign: 'standard',
    maxUserCount: 0,
    maintenanceMode: false,
    showMicrophonesOnMobile: true,
    homePageImage: null,
    homePageLogo: null,
    premiumArticleTopTitle: null,
    premiumArticleTopContent: null,
    premiumArticleMiddleTitle: null,
    premiumArticleMiddleContent: null,
    premiumArticleBottomTitle: null,
    premiumArticleBottomContent: null,
    premiumAndroidAppUrl: null,
    premiumIosAppUrl: null,
    ...overrides,
  });

  const createUpdateSettingsService = (settings: Record<string, unknown>) => {
    const settingsRepository = {
      findOne: jest.fn().mockResolvedValue(settings),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const roomsGateway = {
      disconnectMembersForSystemAccessUpdate: jest.fn(),
      emitTenantSettingsUpdated: jest.fn(),
    };
    const service = new SystemSettingsService(
      settingsRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      roomsGateway as any,
    );

    return { service, settingsRepository, roomsGateway };
  };

  it('getFirstMessageDelay should keep active zero-second delay as zero', async () => {
    const settingsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        firstMessageDelayEnabled: true,
        firstMessageDelaySeconds: 0,
      }),
    };

    const service = new SystemSettingsService(
      settingsRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.getFirstMessageDelay()).resolves.toEqual({
      firstMessageDelayEnabled: true,
      firstMessageDelaySeconds: 0,
      firstMessageDelayUpdatedAt: null,
    });
  });

  it('updateSettings should disconnect active sessions when restrictive access settings are turned off', async () => {
    const { service, roomsGateway } = createUpdateSettingsService(
      createSystemSettings(),
    );

    await service.updateSettings({
      everyoneCanEnter: false,
      guestLoginEnabled: false,
      desktopLoginEnabled: false,
      mobileLoginEnabled: false,
    });

    expect(
      roomsGateway.disconnectMembersForSystemAccessUpdate,
    ).toHaveBeenCalledWith({
      everyoneCanEnterDisabled: true,
      guestLoginDisabled: true,
      desktopLoginDisabled: true,
      mobileLoginDisabled: true,
    });
    expect(roomsGateway.emitTenantSettingsUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'system',
        accessPolicyChanged: true,
        changedFields: expect.arrayContaining([
          'everyoneCanEnter',
          'guestLoginEnabled',
          'desktopLoginEnabled',
          'mobileLoginEnabled',
        ]),
      }),
    );
  });

  it('updateSettings should not disconnect guests when only guest writing is disabled', async () => {
    const { service, roomsGateway } = createUpdateSettingsService(
      createSystemSettings(),
    );

    await service.updateSettings({ guestCanWrite: false });

    expect(
      roomsGateway.disconnectMembersForSystemAccessUpdate,
    ).not.toHaveBeenCalled();
    expect(roomsGateway.emitTenantSettingsUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'system',
        accessPolicyChanged: true,
        changedFields: ['guestCanWrite'],
      }),
    );
  });

  it('repairRoot should restore root privileges and clear moderation locks', async () => {
    const rootUser: any = {
      id: 1,
      username: 'root',
      micBanned: true,
      micBannedByStarCount: 7,
      cameraBanned: true,
      cameraBannedByStarCount: 8,
      globalMuted: true,
      globalMutedByStarCount: 9,
      membershipExpiresAt: null,
      role: null,
      roleId: null,
      permissions: [],
      protection: false,
      protectedByStarCount: 0,
    };
    const rootRole = {
      id: 25,
      name: 'Root',
      starCount: 24,
    };
    const userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(rootUser),
      }),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const roleRepository = {
      findOne: jest.fn().mockResolvedValue(rootRole),
    };
    const userBanRepository = {
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const moderationGateway = {
      emitUserKicked: jest.fn().mockResolvedValue(undefined),
    };

    const service = new SystemSettingsService(
      {} as any,
      userRepository as any,
      roleRepository as any,
      {} as any,
      {} as any,
      userBanRepository as any,
      {} as any,
      moderationGateway as any,
      {} as any,
    );

    await expect(service.repairRoot('admin')).resolves.toEqual({
      message: 'Root hesabı onarıldı.',
    });

    expect(userBanRepository.delete).toHaveBeenCalledWith({ userId: 1 });
    expect(rootUser).toEqual(
      expect.objectContaining({
        micBanned: false,
        micBannedByStarCount: 0,
        cameraBanned: false,
        cameraBannedByStarCount: 0,
        globalMuted: false,
        globalMutedByStarCount: 0,
        username: 'ROOT',
        role: rootRole,
        roleId: rootRole.id,
        permissions: Object.values(PERMISSION_LABELS),
        protection: true,
        protectedByStarCount: rootRole.starCount,
      }),
    );
    expect(roleRepository.findOne).toHaveBeenCalledWith({
      where: { starCount: 24 },
      order: { id: 'ASC' },
    });
    expect(rootUser.membershipExpiresAt.toISOString()).toBe(
      '2030-12-31T23:59:59.000Z',
    );
    expect(userRepository.save).toHaveBeenCalledWith(rootUser);
    expect(moderationGateway.emitUserKicked).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'root',
        kickedByUsername: 'admin',
      }),
    );
  });

  it('changeRootPassword should create root when it is missing', async () => {
    const createdRoot: any = {
      username: 'ROOT',
      gender: 'male',
      isGuest: false,
    };
    const rootRole = {
      id: 25,
      name: 'Root',
      starCount: 24,
    };
    const userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      create: jest.fn().mockReturnValue(createdRoot),
      save: jest.fn().mockImplementation(async (value) => ({ id: 1, ...value })),
    };
    const roleRepository = {
      findOne: jest.fn().mockResolvedValue(rootRole),
    };
    const moderationGateway = {
      emitUserKicked: jest.fn().mockResolvedValue(undefined),
    };

    const service = new SystemSettingsService(
      {} as any,
      userRepository as any,
      roleRepository as any,
      {} as any,
      {} as any,
      { delete: jest.fn() } as any,
      {} as any,
      moderationGateway as any,
      {} as any,
    );

    await expect(service.changeRootPassword('secret', 'admin')).resolves.toEqual({
      message: 'Root şifresi değiştirildi.',
    });

    expect(userRepository.create).toHaveBeenCalledWith({
      username: 'ROOT',
      gender: 'male',
      isGuest: false,
    });
    expect(createdRoot).toEqual(
      expect.objectContaining({
        username: 'ROOT',
        role: rootRole,
        roleId: rootRole.id,
        permissions: Object.values(PERMISSION_LABELS),
        protection: true,
        protectedByStarCount: rootRole.starCount,
        micBanned: false,
        cameraBanned: false,
        globalMuted: false,
      }),
    );
    expect(typeof createdRoot.password).toBe('string');
    expect(userRepository.save).toHaveBeenCalledWith(createdRoot);
  });

  it('changeRootPassword should only update password when root already exists', async () => {
    const existingRoot: any = {
      id: 1,
      username: 'ROOT',
      flashNick: 'keep-flash',
      roleId: 27,
      role: { id: 27, name: 'KİNGROOT', starCount: 27 },
      icon: 'keep-icon',
      fontName: 'Audiowide',
      granite: 'cerceve-2',
      permissions: ['Özel İzin'],
      protection: false,
      protectedByStarCount: 0,
      micBanned: true,
      cameraBanned: true,
      globalMuted: true,
      membershipExpiresAt: new Date('2040-01-01T00:00:00.000Z'),
    };
    const snapshot = {
      username: existingRoot.username,
      flashNick: existingRoot.flashNick,
      roleId: existingRoot.roleId,
      role: existingRoot.role,
      icon: existingRoot.icon,
      fontName: existingRoot.fontName,
      granite: existingRoot.granite,
      permissions: existingRoot.permissions,
      protection: existingRoot.protection,
      protectedByStarCount: existingRoot.protectedByStarCount,
      micBanned: existingRoot.micBanned,
      cameraBanned: existingRoot.cameraBanned,
      globalMuted: existingRoot.globalMuted,
      membershipExpiresAt: existingRoot.membershipExpiresAt,
    };
    const userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existingRoot),
      }),
      create: jest.fn(),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const roleRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 25,
        name: 'Root',
        starCount: 24,
      }),
    };
    const moderationGateway = {
      emitUserKicked: jest.fn().mockResolvedValue(undefined),
    };

    const service = new SystemSettingsService(
      {} as any,
      userRepository as any,
      roleRepository as any,
      {} as any,
      {} as any,
      { delete: jest.fn() } as any,
      {} as any,
      moderationGateway as any,
      {} as any,
    );

    await expect(service.changeRootPassword('next-secret', 'admin')).resolves.toEqual({
      message: 'Root şifresi değiştirildi.',
    });

    expect(userRepository.create).not.toHaveBeenCalled();
    expect(existingRoot).toEqual(expect.objectContaining(snapshot));
    expect(typeof existingRoot.password).toBe('string');
    expect(userRepository.save).toHaveBeenCalledWith(existingRoot);
  });

  it('startSystemReset should delete room messages and emit fixed countdown', async () => {
    const messageRepository = {
      softDelete: jest.fn().mockResolvedValue({ affected: 7 }),
    };
    const roomsGateway = {
      emitSystemResetStarted: jest.fn(),
      getActiveSystemResetPayload: jest.fn().mockReturnValue({
        countdownSeconds: 10,
        remainingDurationMs: 30000,
        message: 'Sistem resetleniyor',
        timestamp: '2026-05-05T12:00:00.000Z',
      }),
    };

    const service = new SystemSettingsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      messageRepository as any,
      {} as any,
      roomsGateway as any,
    );

    await expect(service.startSystemReset()).resolves.toEqual({
      message: 'Sistem resetleme başlatıldı.',
      countdownSeconds: 10,
      remainingDurationMs: 30000,
      timestamp: '2026-05-05T12:00:00.000Z',
      deletedMessagesCount: 7,
    });
    expect(messageRepository.softDelete).toHaveBeenCalledWith({
      deletedAt: expect.anything(),
    });
    expect(roomsGateway.emitSystemResetStarted).toHaveBeenCalledWith({
      countdownSeconds: 10,
      message: 'Sistem resetleniyor',
    });
    expect(service.getSystemResetStatus()).toEqual({
      active: true,
      countdownSeconds: 10,
      remainingDurationMs: 30000,
      message: 'Sistem resetleniyor',
      timestamp: '2026-05-05T12:00:00.000Z',
    });
    roomsGateway.getActiveSystemResetPayload.mockReturnValue(null);
    expect(service.getSystemResetStatus()).toEqual({ active: false });
  });
});
