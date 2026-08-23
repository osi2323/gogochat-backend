import { ForbiddenException } from '@nestjs/common';
import { ModerationService } from './moderation.service';

describe('ModerationService protection checks', () => {
  const createService = ({
    userRepository,
    userBanRepository,
    moderationGateway,
    roomsGateway,
    securitySettingsService,
    loginHistoryService,
  }: {
    userRepository?: any;
    userBanRepository?: any;
    moderationGateway?: any;
    roomsGateway?: any;
    securitySettingsService?: any;
    loginHistoryService?: any;
  } = {}) =>
    new ModerationService(
      (userBanRepository ?? {}) as any,
      (userRepository ?? {}) as any,
      (moderationGateway ?? {}) as any,
      (roomsGateway ?? {}) as any,
      (securitySettingsService ?? {}) as any,
      (loginHistoryService ?? {}) as any,
    );

  const adminUser = (starCount: number) => ({
    id: 1,
    username: 'admin',
    permissions: ['Mikrofon Engelle Yetkisi', 'Kamera Engelle Yetkisi'],
    role: { starCount, permissions: {} },
  });

  const targetUser = (protectedByStarCount: number) => ({
    id: 2,
    username: 'target',
    role: { starCount: 1 },
    protection: true,
    protectedByStarCount,
    micBanned: false,
    micBannedByStarCount: 0,
    cameraBanned: false,
    cameraBannedByStarCount: 0,
    globalMuted: false,
    globalMutedByStarCount: 0,
  });

  it('banUser should block protected user when admin star is lower than protector', async () => {
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(2))
          .mockResolvedValueOnce(targetUser(3)),
      },
      userBanRepository: { save: jest.fn(), create: jest.fn() },
      moderationGateway: { emitUserBanned: jest.fn() },
    });

    await expect(
      service.banUser(1, { username: 'target' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([
    ['banUser', 'root'],
    ['kickUser', 'ROOT'],
    ['toggleMicBan', ' root '],
    ['toggleCameraBan', 'root'],
    ['toggleRoomMute', 'root'],
    ['toggleGlobalMute', 'root'],
    ['deviceBanUser', 'root'],
  ])(
    '%s should reject root target before repository lookup',
    async (methodName, username) => {
      const userRepository = { findOne: jest.fn() };
      const service = createService({ userRepository });
      const run = () => {
        if (methodName === 'banUser') {
          return service.banUser(1, { username } as any);
        }
        if (methodName === 'kickUser') {
          return service.kickUser(1, { username } as any);
        }
        if (methodName === 'toggleMicBan') {
          return service.toggleMicBan(1, username);
        }
        if (methodName === 'toggleCameraBan') {
          return service.toggleCameraBan(1, username);
        }
        if (methodName === 'toggleRoomMute') {
          return service.toggleRoomMute(1, username, 'lobby');
        }
        if (methodName === 'deviceBanUser') {
          return service.deviceBanUser(1, { username } as any);
        }
        return service.toggleGlobalMute(1, username);
      };

      await expect(run()).rejects.toThrow(
        'Root kullanıcısına bu işlem uygulanamaz.',
      );
      expect(userRepository.findOne).not.toHaveBeenCalled();
    },
  );

  it.each([3, 4])(
    'banUser should allow protected user when admin star is %s',
    async (starCount) => {
      const userBanRepository = {
        create: jest.fn().mockImplementation((value) => value),
        save: jest.fn().mockImplementation(async (value) => ({ id: 10, ...value })),
      };
      const moderationGateway = { emitUserBanned: jest.fn() };
      const service = createService({
        userRepository: {
          findOne: jest
            .fn()
            .mockResolvedValueOnce(adminUser(starCount))
            .mockResolvedValueOnce(targetUser(3)),
        },
        userBanRepository,
        moderationGateway,
      });
      jest.spyOn(service, 'findActiveBanForUser').mockResolvedValue(null);

      await expect(
        service.banUser(1, { username: 'target' } as any),
      ).resolves.toMatchObject({
        targetUser: expect.objectContaining({ username: 'target' }),
      });
      expect(userBanRepository.save).toHaveBeenCalled();
      expect(moderationGateway.emitUserBanned).toHaveBeenCalled();
    },
  );

  it('deviceBanUser should create a permanent manual IP ban from active member IP', async () => {
    const securitySettingsService = {
      createOrRefreshFloodBan: jest.fn().mockResolvedValue({ id: 9 }),
    };
    const roomsGateway = {
      findActiveMemberForModeration: jest.fn().mockReturnValue({
        username: 'target',
        isGuest: false,
        roleStarCount: 1,
        ipAddress: '1.2.3.4',
        loginHistoryId: 44,
      }),
      disconnectMembersByIpAddress: jest.fn().mockReturnValue(['target']),
    };
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(5))
          .mockResolvedValueOnce(targetUser(0)),
      },
      roomsGateway,
      securitySettingsService,
      loginHistoryService: {},
    });

    await expect(
      service.deviceBanUser(1, { username: 'target' } as any),
    ).resolves.toEqual({
      ipAddress: '1.2.3.4',
      targetUser: expect.objectContaining({ username: 'target' }),
      affectedUsers: ['target'],
    });
    expect(securitySettingsService.createOrRefreshFloodBan).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: '1.2.3.4',
        source: 'manual_device_ban',
        durationHours: null,
      }),
    );
    expect(roomsGateway.disconnectMembersByIpAddress).toHaveBeenCalledWith(
      '1.2.3.4',
      expect.objectContaining({ bannedByUsername: 'admin' }),
    );
  });

  it('getActiveIpBans should expose active flood bans for the ban list', async () => {
    const service = createService({
      securitySettingsService: {
        getActiveFloodBans: jest.fn().mockResolvedValue({
          items: [
            {
              id: 9,
              ipAddress: '1.2.3.4',
              reason: 'target için manuel cihaz banı',
              source: 'manual_device_ban',
              expiresAt: null,
              createdAt: '2026-05-12T10:00:00.000Z',
              metadata: { targetUsername: 'target' },
            },
          ],
        }),
      },
    });

    await expect(service.getActiveIpBans()).resolves.toEqual([
      expect.objectContaining({
        id: 9,
        ipAddress: '1.2.3.4',
        metadata: expect.objectContaining({ targetUsername: 'target' }),
      }),
    ]);
  });

  it('unbanIp should clear a single active flood ban', async () => {
    const securitySettingsService = {
      clearFloodBanById: jest.fn().mockResolvedValue({
        id: 9,
        ipAddress: '1.2.3.4',
      }),
    };
    const service = createService({
      userRepository: { findOne: jest.fn().mockResolvedValue(adminUser(5)) },
      securitySettingsService,
    });

    await expect(service.unbanIp(1, 9)).resolves.toMatchObject({
      ipAddress: '1.2.3.4',
    });
    expect(securitySettingsService.clearFloodBanById).toHaveBeenCalledWith(9);
  });

  it('deviceBanUser should fall back to requested login history IP', async () => {
    const securitySettingsService = {
      createOrRefreshFloodBan: jest.fn().mockResolvedValue({ id: 9 }),
    };
    const loginHistoryService = {
      findById: jest.fn().mockResolvedValue({
        id: 55,
        userId: 2,
        username: 'target',
        ipAddress: '5.6.7.8',
      }),
      findLatestByUsername: jest.fn(),
    };
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(5))
          .mockResolvedValueOnce(targetUser(0)),
      },
      roomsGateway: {
        findActiveMemberForModeration: jest.fn().mockReturnValue({
          username: 'target',
          isGuest: false,
          roleStarCount: 1,
          ipAddress: null,
          loginHistoryId: null,
        }),
        disconnectMembersByIpAddress: jest.fn().mockReturnValue(['target']),
      },
      securitySettingsService,
      loginHistoryService,
    });

    await expect(
      service.deviceBanUser(1, {
        username: 'target',
        loginHistoryId: 55,
      } as any),
    ).resolves.toMatchObject({ ipAddress: '5.6.7.8' });
    expect(loginHistoryService.findById).toHaveBeenCalledWith(55);
    expect(loginHistoryService.findLatestByUsername).not.toHaveBeenCalled();
  });

  it('deviceBanUser should fall back to latest login history IP', async () => {
    const loginHistoryService = {
      findById: jest.fn(),
      findLatestByUsername: jest.fn().mockResolvedValue({
        username: 'target',
        ipAddress: '9.9.9.9',
      }),
    };
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(5))
          .mockResolvedValueOnce(targetUser(0)),
      },
      roomsGateway: {
        findActiveMemberForModeration: jest.fn().mockReturnValue(null),
        disconnectMembersByIpAddress: jest.fn().mockReturnValue([]),
      },
      securitySettingsService: {
        createOrRefreshFloodBan: jest.fn().mockResolvedValue({ id: 9 }),
      },
      loginHistoryService,
    });

    await expect(
      service.deviceBanUser(1, { username: 'target' } as any),
    ).resolves.toMatchObject({ ipAddress: '9.9.9.9' });
    expect(loginHistoryService.findLatestByUsername).toHaveBeenCalledWith(
      'target',
    );
  });

  it('deviceBanUser should reject self target', async () => {
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(5))
          .mockResolvedValueOnce({ ...targetUser(0), id: 1 }),
      },
      roomsGateway: { findActiveMemberForModeration: jest.fn() },
      securitySettingsService: {},
      loginHistoryService: {},
    });

    await expect(
      service.deviceBanUser(1, { username: 'target' } as any),
    ).rejects.toThrow('Kendinizi cihaz banına alamazsınız');
  });

  it('deviceBanUser should reject equal or higher ranked target', async () => {
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(5))
          .mockResolvedValueOnce({
            ...targetUser(0),
            role: { starCount: 5 },
          }),
      },
      roomsGateway: { findActiveMemberForModeration: jest.fn() },
      securitySettingsService: {},
      loginHistoryService: {},
    });

    await expect(
      service.deviceBanUser(1, { username: 'target' } as any),
    ).rejects.toThrow('Bu işlemi yapmaya hakkınız yok.');
  });

  it('deviceBanUser should block protected user when admin star is lower than protector', async () => {
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(2))
          .mockResolvedValueOnce(targetUser(3)),
      },
      roomsGateway: { findActiveMemberForModeration: jest.fn() },
      securitySettingsService: {},
      loginHistoryService: {},
    });

    await expect(
      service.deviceBanUser(1, { username: 'target' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('kickUser should block protected user when admin star is lower than protector', async () => {
    const roomsGateway = { emitUserKicked: jest.fn() };
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(2))
          .mockResolvedValueOnce(targetUser(3)),
      },
      moderationGateway: roomsGateway,
    });

    await expect(
      service.kickUser(1, { username: 'target' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([3, 4])(
    'kickUser should allow protected user when admin star is %s',
    async (starCount) => {
      const moderationGateway = { emitUserKicked: jest.fn() };
      const service = createService({
        userRepository: {
          findOne: jest
            .fn()
            .mockResolvedValueOnce(adminUser(starCount))
            .mockResolvedValueOnce(targetUser(3)),
        },
        moderationGateway,
      });

      await expect(
        service.kickUser(1, { username: 'target' } as any),
      ).resolves.toBeUndefined();
      expect(moderationGateway.emitUserKicked).toHaveBeenCalled();
    },
  );

  it('unbanUser should block protected user when admin star is lower than protector', async () => {
    const service = createService({
      userRepository: { findOne: jest.fn().mockResolvedValue(adminUser(2)) },
      userBanRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 5,
          user: targetUser(3),
        }),
        delete: jest.fn(),
      },
    });

    await expect(service.unbanUser(1, 5)).rejects.toThrow(ForbiddenException);
  });

  it.each([3, 4])(
    'unbanUser should allow protected user when admin star is %s',
    async (starCount) => {
      const userBanRepository = {
        findOne: jest.fn().mockResolvedValue({
          id: 5,
          user: targetUser(3),
        }),
        delete: jest.fn().mockResolvedValue(undefined),
      };
      const service = createService({
        userRepository: { findOne: jest.fn().mockResolvedValue(adminUser(starCount)) },
        userBanRepository,
      });

      await expect(service.unbanUser(1, 5)).resolves.toBeUndefined();
      expect(userBanRepository.delete).toHaveBeenCalledWith(5);
    },
  );

  it('toggleMicBan should block protected user when admin star is lower than protector', async () => {
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(2))
          .mockResolvedValueOnce(targetUser(3)),
      },
    });

    await expect(service.toggleMicBan(1, 'target')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('toggleMicBan should reject when admin has no Mikrofon Engelle Yetkisi', async () => {
    const service = createService({
      userRepository: {
        findOne: jest.fn().mockResolvedValueOnce({
          id: 1,
          username: 'admin',
          permissions: [],
          role: { starCount: 5, permissions: {} },
        }),
      },
    });

    await expect(service.toggleMicBan(1, 'target')).rejects.toThrow(
      'Mikrofon işlemleri için yetkiniz yok.',
    );
  });

  it.each([3, 4])(
    'toggleMicBan should allow protected user when admin star is %s',
    async (starCount) => {
      const userRepository = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(starCount))
          .mockResolvedValueOnce(targetUser(3)),
        save: jest.fn().mockImplementation(async (value) => value),
      };
      const roomsGateway = { setMicBanState: jest.fn() };
      const moderationGateway = { emitMicBanToggled: jest.fn() };
      const service = createService({
        userRepository,
        roomsGateway,
        moderationGateway,
      });

      await expect(service.toggleMicBan(1, 'target')).resolves.toMatchObject({
        micBanned: true,
      });
      expect(userRepository.save).toHaveBeenCalled();
    },
  );

  it('toggleCameraBan should block protected user when admin star is lower than protector', async () => {
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(2))
          .mockResolvedValueOnce(targetUser(3)),
      },
    });

    await expect(service.toggleCameraBan(1, 'target')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('toggleCameraBan should reject when admin has no Kamera Engelle Yetkisi', async () => {
    const service = createService({
      userRepository: {
        findOne: jest.fn().mockResolvedValueOnce({
          id: 1,
          username: 'admin',
          permissions: ['Mikrofon Engelle Yetkisi'],
          role: { starCount: 5, permissions: {} },
        }),
      },
    });

    await expect(service.toggleCameraBan(1, 'target')).rejects.toThrow(
      'Kamera engelle yetkiniz yok.',
    );
  });

  it.each([3, 4])(
    'toggleCameraBan should allow protected user when admin star is %s',
    async (starCount) => {
      const userRepository = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(starCount))
          .mockResolvedValueOnce(targetUser(3)),
        save: jest.fn().mockImplementation(async (value) => value),
      };
      const roomsGateway = { setCameraBanState: jest.fn() };
      const moderationGateway = { emitCameraBanToggled: jest.fn() };
      const service = createService({
        userRepository,
        roomsGateway,
        moderationGateway,
      });

      await expect(service.toggleCameraBan(1, 'target')).resolves.toMatchObject({
        cameraBanned: true,
      });
      expect(userRepository.save).toHaveBeenCalled();
    },
  );

  it('toggleRoomMute should block protected user when admin star is lower than protector', async () => {
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(2))
          .mockResolvedValueOnce(targetUser(3)),
      },
    });

    await expect(service.toggleRoomMute(1, 'target', 'lobby')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('toggleRoomMute should reject when admin has no Mikrofon Engelle Yetkisi', async () => {
    const service = createService({
      userRepository: {
        findOne: jest.fn().mockResolvedValueOnce({
          id: 1,
          username: 'admin',
          permissions: [],
          role: { starCount: 5, permissions: {} },
        }),
      },
    });

    await expect(service.toggleRoomMute(1, 'target', 'lobby')).rejects.toThrow(
      'Mikrofon işlemleri için yetkiniz yok.',
    );
  });

  it.each([3, 4])(
    'toggleRoomMute should allow protected user when admin star is %s',
    async (starCount) => {
      const roomsGateway = {
        findActiveMemberForModeration: jest.fn().mockReturnValue({
          username: 'target',
          roleStarCount: 1,
          roomMuted: false,
          roomMutedByStarCount: 0,
        }),
        setRoomMuteState: jest.fn().mockReturnValue(true),
      };
      const service = createService({
        userRepository: {
          findOne: jest
            .fn()
            .mockResolvedValueOnce(adminUser(starCount))
            .mockResolvedValueOnce(targetUser(3)),
        },
        roomsGateway,
      });

      await expect(
        service.toggleRoomMute(1, 'target', 'lobby'),
      ).resolves.toMatchObject({
        roomMuted: true,
      });
      expect(roomsGateway.setRoomMuteState).toHaveBeenCalled();
    },
  );

  it('toggleGlobalMute should block protected user when admin star is lower than protector', async () => {
    const service = createService({
      userRepository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(2))
          .mockResolvedValueOnce(targetUser(3)),
      },
    });

    await expect(service.toggleGlobalMute(1, 'target')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('toggleGlobalMute should reject when admin has no Mikrofon Engelle Yetkisi', async () => {
    const service = createService({
      userRepository: {
        findOne: jest.fn().mockResolvedValueOnce({
          id: 1,
          username: 'admin',
          permissions: [],
          role: { starCount: 5, permissions: {} },
        }),
      },
    });

    await expect(service.toggleGlobalMute(1, 'target')).rejects.toThrow(
      'Mikrofon işlemleri için yetkiniz yok.',
    );
  });

  it.each([3, 4])(
    'toggleGlobalMute should allow protected user when admin star is %s',
    async (starCount) => {
      const userRepository = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(adminUser(starCount))
          .mockResolvedValueOnce(targetUser(3)),
        save: jest.fn().mockImplementation(async (value) => value),
      };
      const roomsGateway = { setGlobalMuteState: jest.fn() };
      const moderationGateway = { emitMuteStateChanged: jest.fn() };
      const service = createService({
        userRepository,
        roomsGateway,
        moderationGateway,
      });

      await expect(service.toggleGlobalMute(1, 'target')).resolves.toMatchObject(
        {
          globalMuted: true,
        },
      );
      expect(userRepository.save).toHaveBeenCalled();
    },
  );

  it('clearGlobalMutes should clear registered global mutes allowed by admin rank', async () => {
    const mutedUser = {
      ...targetUser(0),
      globalMuted: true,
      globalMutedByStarCount: 2,
    };
    const userRepository = {
      findOne: jest.fn().mockResolvedValueOnce(adminUser(5)),
      find: jest.fn().mockResolvedValueOnce([mutedUser]),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const roomsGateway = {
      setGlobalMuteState: jest.fn(),
      clearGlobalMuteStates: jest
        .fn()
        .mockReturnValue({ clearedCount: 0, skippedCount: 0 }),
    };
    const service = createService({ userRepository, roomsGateway });

    await expect(service.clearGlobalMutes(1)).resolves.toEqual({
      clearedCount: 1,
      skippedCount: 0,
    });
    expect(userRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        globalMuted: false,
        globalMutedByStarCount: 0,
      }),
    ]);
    expect(roomsGateway.setGlobalMuteState).toHaveBeenCalledWith(
      'target',
      false,
      0,
      'admin',
    );
    expect(roomsGateway.clearGlobalMuteStates).toHaveBeenCalledWith(
      5,
      'admin',
      false,
      ['target'],
    );
  });

  it('clearGlobalMutes should skip registered users blocked by rank or mute owner', async () => {
    const sameRankUser = {
      ...targetUser(0),
      role: { starCount: 5 },
      globalMuted: true,
      globalMutedByStarCount: 1,
    };
    const higherMuteOwnerUser = {
      ...targetUser(0),
      id: 3,
      username: 'muted-by-higher',
      globalMuted: true,
      globalMutedByStarCount: 6,
    };
    const userRepository = {
      findOne: jest.fn().mockResolvedValueOnce(adminUser(5)),
      find: jest
        .fn()
        .mockResolvedValueOnce([sameRankUser, higherMuteOwnerUser]),
      save: jest.fn(),
    };
    const roomsGateway = {
      setGlobalMuteState: jest.fn(),
      clearGlobalMuteStates: jest
        .fn()
        .mockReturnValue({ clearedCount: 0, skippedCount: 0 }),
    };
    const service = createService({ userRepository, roomsGateway });

    await expect(service.clearGlobalMutes(1)).resolves.toEqual({
      clearedCount: 0,
      skippedCount: 2,
    });
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(roomsGateway.setGlobalMuteState).not.toHaveBeenCalled();
  });

  it('clearGlobalMutes should skip protected registered users when admin star is lower than protector', async () => {
    const protectedUser = {
      ...targetUser(6),
      globalMuted: true,
      globalMutedByStarCount: 1,
    };
    const userRepository = {
      findOne: jest.fn().mockResolvedValueOnce(adminUser(5)),
      find: jest.fn().mockResolvedValueOnce([protectedUser]),
      save: jest.fn(),
    };
    const roomsGateway = {
      setGlobalMuteState: jest.fn(),
      clearGlobalMuteStates: jest
        .fn()
        .mockReturnValue({ clearedCount: 0, skippedCount: 0 }),
    };
    const service = createService({ userRepository, roomsGateway });

    await expect(service.clearGlobalMutes(1)).resolves.toEqual({
      clearedCount: 0,
      skippedCount: 1,
    });
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('clearGlobalMutes should include active guest global mutes from gateway', async () => {
    const userRepository = {
      findOne: jest.fn().mockResolvedValueOnce(adminUser(5)),
      find: jest.fn().mockResolvedValueOnce([]),
      save: jest.fn(),
    };
    const roomsGateway = {
      clearGlobalMuteStates: jest
        .fn()
        .mockReturnValue({ clearedCount: 1, skippedCount: 1 }),
    };
    const service = createService({ userRepository, roomsGateway });

    await expect(service.clearGlobalMutes(1)).resolves.toEqual({
      clearedCount: 1,
      skippedCount: 1,
    });
    expect(roomsGateway.clearGlobalMuteStates).toHaveBeenCalledWith(
      5,
      'admin',
      false,
      [],
    );
  });
});
