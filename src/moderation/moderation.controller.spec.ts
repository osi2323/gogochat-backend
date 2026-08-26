jest.mock(
  'src/common/decorators/public.decorator',
  () => ({
    IS_PUBLIC_KEY: 'isPublic',
  }),
  { virtual: true },
);

const { ModerationController } = require('./moderation.controller');

describe('ModerationController kick permission checks', () => {
  const createController = () => {
    const moderationService = {
      kickUser: jest.fn().mockResolvedValue(undefined),
      toggleCameraBan: jest.fn().mockResolvedValue({
        cameraBanned: true,
        targetUserId: 7,
        targetUsername: 'target',
        isGuest: false,
      }),
      deviceBanUser: jest.fn().mockResolvedValue({
        ipAddress: '1.2.3.4',
        targetUser: { id: 7, username: 'target' },
        affectedUsers: ['target'],
      }),
      getBannedUsers: jest.fn().mockResolvedValue([
        {
          id: 10,
          user: { username: 'target' },
          bannedBy: { username: 'admin', role: { starCount: 5 } },
          reason: 'Hesap banı',
          expiresAt: null,
          createdAt: new Date('2026-05-12T10:00:00.000Z'),
        },
      ]),
      getActiveIpBans: jest.fn().mockResolvedValue([
        {
          id: 20,
          ipAddress: '1.2.3.4',
          reason: 'target için manuel cihaz banı',
          source: 'manual_device_ban',
          expiresAt: null,
          createdAt: new Date('2026-05-12T11:00:00.000Z'),
          metadata: {
            targetUsername: 'target',
            bannedByUsername: 'admin',
            targetUserId: 7,
          },
        },
      ]),
      unbanIp: jest.fn().mockResolvedValue({
        id: 20,
        ipAddress: '1.2.3.4',
        source: 'manual_device_ban',
        metadata: {
          targetUsername: 'target',
          targetUserId: 7,
        },
      }),
    };
    const adminActionsService = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };
    const userService = {
      findById: jest.fn(),
    };

    const controller = new ModerationController(
      moderationService as any,
      adminActionsService as any,
      userService as any,
    );

    return { controller, moderationService, adminActionsService, userService };
  };

  it('kickUser should reject when Admin Paneli permission is missing', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 5,
      username: 'moderator',
      permissions: [],
      role: { permissions: {} },
    });

    await expect(
      controller.kickUser(
        { user: { sub: 5, username: 'moderator' } } as any,
        { username: 'target' } as any,
      ),
    ).rejects.toThrow('Admin paneli erişim yetkiniz yok.');
  });

  it('kickUser should reject when Siteden Atma Yetkisi is missing', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 5,
      username: 'moderator',
      permissions: ['Admin Paneli'],
      role: { permissions: {} },
    });

    await expect(
      controller.kickUser(
        { user: { sub: 5, username: 'moderator' } } as any,
        { username: 'target' } as any,
      ),
    ).rejects.toThrow('Siteden atma yetkiniz yok.');
  });

  it('kickUser should allow when both Admin Paneli and Siteden Atma Yetkisi exist', async () => {
    const { controller, moderationService, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 5,
      username: 'moderator',
      permissions: ['Admin Paneli', 'Siteden Atma Yetkisi'],
      role: { permissions: {} },
    });

    await expect(
      controller.kickUser(
        { user: { sub: 5, username: 'moderator' } } as any,
        { username: 'target' } as any,
      ),
    ).resolves.toBeUndefined();
    expect(moderationService.kickUser).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ username: 'target' }),
    );
  });

  it('kickUser should allow root bypass', async () => {
    const { controller, moderationService, userService } = createController();

    await expect(
      controller.kickUser(
        { user: { sub: 1, username: 'root' } } as any,
        { username: 'target' } as any,
      ),
    ).resolves.toBeUndefined();
    expect(userService.findById).not.toHaveBeenCalled();
    expect(moderationService.kickUser).toHaveBeenCalled();
  });

  it('toggleCameraBan should reject when Kamera Engelle Yetkisi is missing', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 5,
      username: 'moderator',
      permissions: ['Admin Paneli'],
      role: { permissions: {} },
    });

    await expect(
      controller.toggleCameraBan(
        { user: { sub: 5, username: 'moderator' } } as any,
        { username: 'target' } as any,
      ),
    ).rejects.toThrow('Kamera engelle yetkiniz yok.');
  });

  it('toggleCameraBan should allow when Admin Paneli and Kamera Engelle Yetkisi exist', async () => {
    const { controller, moderationService, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 5,
      username: 'moderator',
      permissions: ['Admin Paneli', 'Kamera Engelle Yetkisi'],
      role: { permissions: {} },
    });

    await expect(
      controller.toggleCameraBan(
        { user: { sub: 5, username: 'moderator' } } as any,
        { username: 'target' } as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ cameraBanned: true }));
    expect(moderationService.toggleCameraBan).toHaveBeenCalledWith(5, 'target');
  });

  it('toggleCameraBan should allow root bypass', async () => {
    const { controller, moderationService, userService } = createController();

    await expect(
      controller.toggleCameraBan(
        { user: { sub: 1, username: 'root' } } as any,
        { username: 'target' } as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ cameraBanned: true }));
    expect(userService.findById).not.toHaveBeenCalled();
    expect(moderationService.toggleCameraBan).toHaveBeenCalledWith(1, 'target');
  });

  it('deviceBanUser should require Banlama permission', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 5,
      username: 'moderator',
      permissions: ['Admin Paneli'],
      role: { permissions: {} },
    });

    await expect(
      controller.deviceBanUser(
        { user: { sub: 5, username: 'moderator' } } as any,
        { username: 'target' } as any,
      ),
    ).rejects.toThrow('Banlama yetkiniz yok.');
  });

  it('deviceBanUser should allow when Admin Paneli and Banlama exist', async () => {
    const { controller, moderationService, userService, adminActionsService } =
      createController();
    userService.findById.mockResolvedValue({
      id: 5,
      username: 'moderator',
      permissions: ['Admin Paneli', 'Banlama'],
      role: { permissions: {} },
    });

    await expect(
      controller.deviceBanUser(
        { user: { sub: 5, username: 'moderator' } } as any,
        { username: 'target', loginHistoryId: 44 } as any,
      ),
    ).resolves.toEqual({
      ipAddress: '1.2.3.4',
      affectedUsers: ['target'],
    });
    expect(moderationService.deviceBanUser).toHaveBeenCalledWith(5, {
      username: 'target',
      loginHistoryId: 44,
    });
    expect(adminActionsService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'ADMIN_DEVICE_BAN',
        targetUsername: 'target',
      }),
    );
  });

  it('getBannedUsers should include active IP bans', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 5,
      username: 'moderator',
      permissions: ['Admin Paneli', 'Banlama'],
      role: { permissions: {} },
    });

    await expect(
      controller.getBannedUsers({
        user: { sub: 5, username: 'moderator' },
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        total: 2,
        bannedUsers: expect.arrayContaining([
          expect.objectContaining({
            id: 10,
            banType: 'user',
            username: 'target',
          }),
          expect.objectContaining({
            id: 20,
            banType: 'ip',
            ipAddress: '1.2.3.4',
            username: 'target',
          }),
        ]),
      }),
    );
  });

  it('unbanIp should require Banlama permission', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 5,
      username: 'moderator',
      permissions: ['Admin Paneli'],
      role: { permissions: {} },
    });

    await expect(
      controller.unbanIp(
        { user: { sub: 5, username: 'moderator' } } as any,
        '20',
      ),
    ).rejects.toThrow('Banlama yetkiniz yok.');
  });

  it('unbanIp should clear active IP ban and log action', async () => {
    const { controller, moderationService, userService, adminActionsService } =
      createController();
    userService.findById.mockResolvedValue({
      id: 5,
      username: 'moderator',
      permissions: ['Admin Paneli', 'Banlama'],
      role: { permissions: {} },
    });

    await expect(
      controller.unbanIp(
        { user: { sub: 5, username: 'moderator' } } as any,
        '20',
      ),
    ).resolves.toBeUndefined();
    expect(moderationService.unbanIp).toHaveBeenCalledWith(5, 20);
    expect(adminActionsService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'ADMIN_IP_UNBAN',
        targetUsername: 'target',
        metadata: expect.objectContaining({ ipAddress: '1.2.3.4' }),
      }),
    );
  });
});
