import { RoomsGateway } from './rooms.gateway';

describe('RoomsGateway protection checks', () => {
  afterEach(() => {
    const gatewayClass = RoomsGateway as any;
    if (gatewayClass.systemResetDisconnectTimer) {
      clearTimeout(gatewayClass.systemResetDisconnectTimer);
      gatewayClass.systemResetDisconnectTimer = null;
    }
    gatewayClass.activeSystemResetState = null;
    gatewayClass.recentRoomLeaves?.clear?.();
  });

  const createGateway = (options?: {
    protectedUser?: {
      username: string;
      protection: boolean;
      protectedByStarCount: number;
      permissions?: string[];
      role?: { starCount: number; permissions?: Record<string, boolean> };
      joinEffect?: string;
    };
    senderPersistedUser?: {
      username: string;
      permissions?: string[];
      role?: { starCount: number; permissions?: Record<string, boolean> };
    };
    roomMinStar?: number | null;
	    joinUser?: {
	      username: string;
	      role?: { starCount: number } | null;
	    } | null;
	    guestSystemEnabled?: boolean;
	  }) => {
    const protectedUser = options?.protectedUser ?? {
      username: 'target',
      protection: true,
      protectedByStarCount: 3,
    };
    const senderPersistedUser = options?.senderPersistedUser ?? {
      username: 'admin',
      permissions: ['Mikrofon Engelle Yetkisi', 'Mikrofon Daveti'],
      role: { starCount: 2, permissions: {} },
    };
    const roomMembers = new Map([
      [
        'lobby',
        new Map([
          [
            'admin',
            {
              socketId: 'sender-socket',
              username: 'admin',
              gender: 'male',
              isGuest: false,
              roleStarCount: 2,
              tenantId: 'tenant_master',
            },
          ],
          [
            'target',
            {
              userId: 2,
              socketId: 'target-socket',
              username: protectedUser.username,
              gender: 'male',
              isGuest: false,
              roleStarCount: 1,
              tenantId: 'tenant_master',
              isInVoiceChat: true,
              roomMuted: false,
              roomMutedByStarCount: 0,
            },
          ],
        ]),
      ],
    ]);

    const roomsState = {
      rooms: roomMembers,
      roomNames: new Map([['lobby', 'Lobby']]),
      socketRooms: new Map(),
    };

    let requestedUsername = '';
    let requestedUsernames: string[] = [];
    const userQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest
        .fn()
        .mockImplementation((_, params: { username?: string; usernames?: string[] }) => {
        requestedUsername = String(params?.username || '');
        requestedUsernames = Array.isArray(params?.usernames)
          ? params.usernames.map((value) => String(value).trim().toLowerCase())
          : [];
        return userQueryBuilder;
      }),
      getOne: jest.fn().mockImplementation(async () => {
        const normalizedRequested = requestedUsername.trim().toLowerCase();
        if (normalizedRequested === 'admin') {
          return senderPersistedUser;
        }
        if (normalizedRequested === String(protectedUser.username).toLowerCase()) {
          return protectedUser;
        }
        return null;
      }),
      getMany: jest.fn().mockImplementation(async () => {
        const users = [];
        if (requestedUsernames.includes('admin')) {
          users.push(senderPersistedUser);
        }
        if (
          requestedUsernames.includes(
            String(protectedUser.username).trim().toLowerCase(),
          )
        ) {
          users.push(protectedUser);
        }
        return users;
      }),
      select: jest.fn().mockReturnThis(),
    };

    const roomRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    };

    const userRepository = {
      createQueryBuilder: jest.fn().mockImplementation((alias: string) => {
        if (alias === 'user') {
          return userQueryBuilder;
        }
        return { where: jest.fn().mockReturnThis(), getOne: jest.fn() };
      }),
    };

    const gateway = new RoomsGateway(
      {} as any,
      roomsState as any,
      {} as any,
      roomRepository as any,
      {} as any,
      userRepository as any,
      {} as any,
    );

    const toEmit = { emit: jest.fn() };
    const server = {
      sockets: {
        sockets: new Map([
          ['sender-socket', { id: 'sender-socket' }],
          ['target-socket', { id: 'target-socket' }],
        ]),
      },
      to: jest.fn().mockReturnValue(toEmit),
      emit: jest.fn(),
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([]),
      }),
    };

    (gateway as any).server = server;

    return {
      gateway,
      roomMembers,
      roomsState,
      roomRepository,
      server,
      toEmit,
      userQueryBuilder,
      userRepository,
    };
  };

  const createAccessPolicyGateway = () => {
    const roomMembers = new Map([
      [
        'lobby',
        new Map([
          [
            'root',
            {
              socketId: 'root-socket',
              username: 'root',
              gender: 'male',
              isGuest: false,
              tenantId: 'tenant_master',
              deviceType: 'desktop',
            },
          ],
          [
            'member',
            {
              socketId: 'member-socket',
              username: 'member',
              gender: 'male',
              isGuest: false,
              tenantId: 'tenant_master',
              deviceType: 'desktop',
            },
          ],
          [
            'guest',
            {
              socketId: 'guest-socket',
              username: 'guest',
              gender: 'male',
              isGuest: true,
              tenantId: 'tenant_master',
              deviceType: 'mobile',
            },
          ],
          [
            'unknown',
            {
              socketId: 'unknown-socket',
              username: 'unknown',
              gender: 'male',
              isGuest: false,
              tenantId: 'tenant_master',
            },
          ],
        ]),
      ],
    ]);
    const roomsState = {
      rooms: roomMembers,
      roomNames: new Map([['lobby', 'Lobby']]),
      socketRooms: new Map(),
    };
    const gateway = new RoomsGateway(
      {} as any,
      roomsState as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const sockets = new Map(
      ['root-socket', 'member-socket', 'guest-socket', 'unknown-socket'].map(
        (socketId) => [
          socketId,
          { id: socketId, emit: jest.fn(), disconnect: jest.fn() },
        ],
      ),
    );
    (gateway as any).server = {
      sockets: { sockets },
      emit: jest.fn(),
    };

    return { gateway, sockets };
  };

  it('disconnectMembersForSystemAccessUpdate also disconnects guests tracked only in socket presence', () => {
    const { gateway, sockets } = createAccessPolicyGateway();
    const presenceOnlySocket = {
      id: 'presence-only-guest-socket',
      emit: jest.fn(),
      disconnect: jest.fn(),
      data: {
        roomPresenceState: {
          username: 'presenceGuest',
          isGuest: true,
          deviceType: 'mobile',
          tenantId: 'tenant_master',
        },
      },
    };
    sockets.set('presence-only-guest-socket', presenceOnlySocket);

    expect(
      gateway.disconnectMembersForSystemAccessUpdate({
        guestLoginDisabled: true,
      }),
    ).toBe(2);

    expect(sockets.get('guest-socket')?.disconnect).toHaveBeenCalledWith(true);
    expect(presenceOnlySocket.emit).toHaveBeenCalledWith(
      'system:accessRevoked',
      expect.objectContaining({
        reason: 'guest_entries_disabled',
        username: 'presenceGuest',
        isGuest: true,
      }),
    );
    expect(presenceOnlySocket.disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnectMembersForSystemAccessUpdate disconnects guests when guest login is disabled', () => {
    const { gateway, sockets } = createAccessPolicyGateway();

    expect(
      gateway.disconnectMembersForSystemAccessUpdate({
        guestLoginDisabled: true,
      }),
    ).toBe(1);

    expect(sockets.get('guest-socket')?.disconnect).toHaveBeenCalledWith(true);
    expect(sockets.get('member-socket')?.disconnect).not.toHaveBeenCalled();
    expect(sockets.get('root-socket')?.disconnect).not.toHaveBeenCalled();
  });

  it('disconnectMembersForSystemAccessUpdate disconnects everyone except root when site entry is disabled', () => {
    const { gateway, sockets } = createAccessPolicyGateway();

    expect(
      gateway.disconnectMembersForSystemAccessUpdate({
        everyoneCanEnterDisabled: true,
      }),
    ).toBe(3);

    expect(sockets.get('root-socket')?.disconnect).not.toHaveBeenCalled();
    expect(sockets.get('member-socket')?.disconnect).toHaveBeenCalledWith(true);
    expect(sockets.get('guest-socket')?.disconnect).toHaveBeenCalledWith(true);
    expect(sockets.get('unknown-socket')?.disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnectMembersForSystemAccessUpdate disconnects only known desktop or mobile devices for device restrictions', () => {
    const { gateway, sockets } = createAccessPolicyGateway();

    expect(
      gateway.disconnectMembersForSystemAccessUpdate({
        desktopLoginDisabled: true,
      }),
    ).toBe(1);
    expect(sockets.get('member-socket')?.disconnect).toHaveBeenCalledWith(true);
    expect(sockets.get('guest-socket')?.disconnect).not.toHaveBeenCalled();
    expect(sockets.get('unknown-socket')?.disconnect).not.toHaveBeenCalled();

    (sockets.get('member-socket')?.disconnect as jest.Mock).mockClear();

    expect(
      gateway.disconnectMembersForSystemAccessUpdate({
        mobileLoginDisabled: true,
      }),
    ).toBe(1);
    expect(sockets.get('guest-socket')?.disconnect).toHaveBeenCalledWith(true);
    expect(sockets.get('member-socket')?.disconnect).not.toHaveBeenCalled();
    expect(sockets.get('unknown-socket')?.disconnect).not.toHaveBeenCalled();
  });

  it('disconnectMembersForSystemAccessUpdate disconnects mobile users from fallback device fields', () => {
    const { gateway, sockets } = createAccessPolicyGateway();
    const mobileSocket = {
      id: 'presence-mobile-socket',
      emit: jest.fn(),
      disconnect: jest.fn(),
      data: {
        roomPresenceState: {
          username: 'mobileMember',
          isGuest: false,
          deviceType: 'browser',
          clientType: 'web',
          device: 'ios mobile safari',
          tenantId: 'tenant_master',
        },
      },
    };
    sockets.set('presence-mobile-socket', mobileSocket);

    expect(
      gateway.disconnectMembersForSystemAccessUpdate({
        mobileLoginDisabled: true,
      }),
    ).toBe(2);

    expect(sockets.get('guest-socket')?.disconnect).toHaveBeenCalledWith(true);
    expect(mobileSocket.disconnect).toHaveBeenCalledWith(true);
    expect(mobileSocket.emit).toHaveBeenCalledWith(
      'system:accessRevoked',
      expect.objectContaining({
        reason: 'mobile_entries_disabled',
        username: 'mobileMember',
      }),
    );
  });

  const createJoinGateway = (options?: {
    roomMinStar?: number | null;
    roomName?: string;
    roomVoiceId?: string;
    aiBot?: {
      id?: number;
      username?: string;
      room?: string;
      welcomeMessage?: string | null;
      welcomeAutoSendEnabled?: boolean;
      welcomeManualPromptEnabled?: boolean;
      isAI?: boolean;
    } | null;
    joinUser?: {
      username: string;
      permissions?: string[];
      role?:
        | {
            name?: string;
            starCount: number;
            starColor?: string;
            icon?: string | null;
            permissions?: Record<string, boolean>;
          }
        | null;
    } | null;
  }) => {
    const roomMinStar = options?.roomMinStar ?? null;
    const roomName = options?.roomName ?? 'Lobby';
    const defaultRoomVoiceId =
      roomName === 'Lobby'
        ? 'lobby'
        : roomName.toLowerCase().replace(/ı/g, 'i').replace(/\s+/g, '-');
    const roomVoiceId = options?.roomVoiceId ?? defaultRoomVoiceId;
    const aiBot = options?.aiBot;
    const joinUser = options?.joinUser ?? {
      username: 'member',
      permissions: [],
      role: { starCount: 0, permissions: {} },
    };

    const roomsState = {
      rooms: new Map<string, Map<string, any>>(),
      roomNames: new Map([['lobby', 'Lobby']]),
      socketRooms: new Map(),
    };

    let requestedUsernames: string[] = [];
    const userQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest
        .fn()
        .mockImplementation((_, params: { usernames?: string[] }) => {
          requestedUsernames = Array.isArray(params?.usernames)
            ? params.usernames.map((value) => String(value).trim().toLowerCase())
            : [];
          return userQueryBuilder;
        }),
      getOne: jest.fn().mockResolvedValue(joinUser),
      getMany: jest.fn().mockImplementation(async () => {
        return requestedUsernames.map((username) => {
          if (username === 'root') {
            return {
              id: 999,
              username: 'root',
              role: {
                starCount: 7,
              },
            };
          }

          if (
            joinUser &&
            String(joinUser.username).trim().toLowerCase() === username
          ) {
            return {
              id: 1,
              ...joinUser,
            };
          }

          return {
            id: 1,
            username,
            role: null,
          };
        });
      }),
    };

    const roomEntity =
      roomMinStar === null
        ? null
        : { id: 1, name: roomName, voiceId: roomVoiceId, minStar: roomMinStar };
    const lobbyRoomEntity = { id: 99, name: 'Lobi', voiceId: 'lobby', minStar: 0 };
    let roomLookupCount = 0;
    const roomQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockImplementation(async () => {
        roomLookupCount += 1;
        if (roomVoiceId !== 'lobby' && roomLookupCount > 1) {
          return lobbyRoomEntity;
        }
        return roomEntity;
      }),
    };

    const roomRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue(roomQueryBuilder),
    };

    const userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(userQueryBuilder),
    };

	    const gateway = new RoomsGateway(
	      {} as any,
	      roomsState as any,
	      {} as any,
	      roomRepository as any,
	      {} as any,
	      userRepository as any,
	      {
	        findOne: jest.fn().mockResolvedValue(aiBot ?? null),
	        find: jest.fn().mockResolvedValue(aiBot ? [aiBot] : []),
	      } as any,
	      {} as any,
	      {
	        getSettings: jest.fn().mockResolvedValue({
	          guestSystemEnabled: options?.guestSystemEnabled ?? false,
	        }),
	        hasActiveFloodBan: jest.fn().mockResolvedValue(false),
	      } as any,
	    );

    const toEmit = { emit: jest.fn() };
    const server = {
      sockets: {
        sockets: new Map([['join-socket', { id: 'join-socket' }]]),
      },
      to: jest.fn().mockReturnValue(toEmit),
      emit: jest.fn(),
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([]),
      }),
    };

    (gateway as any).server = server;

    return {
      gateway,
      roomMembers: roomsState.rooms,
      roomQueryBuilder,
      roomRepository,
      server,
      toEmit,
      userQueryBuilder,
      userRepository,
    };
  };

  const createCallGateway = (options?: {
    callerIsGuest?: boolean;
    targetIsGuest?: boolean;
    callerAgentNickname?: string | null;
    targetAgentNickname?: string | null;
    membersVoiceCallEnabled?: boolean;
    guestVoiceCallEnabled?: boolean;
  }) => {
    const callerIsGuest = options?.callerIsGuest ?? false;
    const targetIsGuest = options?.targetIsGuest ?? false;
    const callerUsername = callerIsGuest ? 'guest-caller' : 'member-caller';
    const targetUsername = targetIsGuest ? 'guest-target' : 'member-target';
    const activeCalls = new Map<string, any>();
    const userActiveCalls = new Map<string, string>();
    const roomMembers = new Map([
      [
        'lobby',
        new Map([
          [
            callerUsername,
            {
              socketId: 'caller-socket',
              username: callerUsername,
              gender: 'male',
              isGuest: callerIsGuest,
              tenantId: 'master',
              roleStarCount: 0,
              agentNickname: options?.callerAgentNickname ?? undefined,
            },
          ],
          [
            targetUsername,
            {
              socketId: 'target-socket',
              username: targetUsername,
              gender: 'female',
              isGuest: targetIsGuest,
              tenantId: 'master',
              roleStarCount: 0,
              agentNickname: options?.targetAgentNickname ?? undefined,
            },
          ],
        ]),
      ],
    ]);
    const roomsState = {
      rooms: roomMembers,
      roomNames: new Map([['lobby', 'Lobby']]),
      socketRooms: new Map(),
      activeCalls,
      userActiveCalls,
    };
    const systemSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        membersVoiceCallEnabled: options?.membersVoiceCallEnabled ?? true,
        guestVoiceCallEnabled: options?.guestVoiceCallEnabled ?? true,
      }),
    };
    const userQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, username: callerUsername },
        { id: 2, username: targetUsername },
      ]),
    };
    const userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(userQueryBuilder),
    };
    const friendRequestRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const gateway = new RoomsGateway(
      systemSettingsService as any,
      roomsState as any,
      {} as any,
      {} as any,
      friendRequestRepository as any,
      userRepository as any,
      {} as any,
    );
    const emitByTarget = new Map<string, jest.Mock>();
    const server = {
      sockets: {
        sockets: new Map([
          ['caller-socket', { id: 'caller-socket' }],
          ['target-socket', { id: 'target-socket' }],
        ]),
      },
      to: jest.fn().mockImplementation((target: string) => {
        const emit = jest.fn();
        emitByTarget.set(target, emit);
        return { emit };
      }),
      emit: jest.fn(),
    };
    (gateway as any).server = server;

    return {
      activeCalls,
      callerUsername,
      emitByTarget,
      gateway,
      targetUsername,
      userActiveCalls,
    };
  };

  it('handleCallRequest rejects guest caller when guest calls are disabled', async () => {
    const { callerUsername, emitByTarget, gateway, targetUsername } =
      createCallGateway({
        callerIsGuest: true,
        targetIsGuest: false,
        membersVoiceCallEnabled: true,
        guestVoiceCallEnabled: false,
      });

    await expect(
      gateway.handleCallRequest(
        {
          targetUsername,
          callerUsername,
          callerIsGuest: true,
          tenantId: 'tenant_master',
          callId: 'call-guest-disabled',
        } as any,
        { id: 'caller-socket', username: callerUsername } as any,
      ),
    ).resolves.toEqual({ status: 'error', message: 'not_allowed' });

    expect(emitByTarget.get('caller-socket')).toHaveBeenCalledWith(
      'call:rejected',
      {
        callId: 'call-guest-disabled',
        reason: 'not_allowed',
        code: 'guest_voice_call_disabled',
      },
    );
  });

  it('handleCallRequest rejects member caller when member calls are disabled', async () => {
    const { callerUsername, emitByTarget, gateway, targetUsername } =
      createCallGateway({
        callerIsGuest: false,
        targetIsGuest: true,
        membersVoiceCallEnabled: false,
        guestVoiceCallEnabled: true,
      });

    await expect(
      gateway.handleCallRequest(
        {
          targetUsername,
          callerUsername,
          callerIsGuest: false,
          tenantId: 'tenant_master',
          callId: 'call-member-disabled',
        } as any,
        { id: 'caller-socket', username: callerUsername } as any,
      ),
    ).resolves.toEqual({ status: 'error', message: 'not_allowed' });

    expect(emitByTarget.get('caller-socket')).toHaveBeenCalledWith(
      'call:rejected',
      {
        callId: 'call-member-disabled',
        reason: 'not_allowed',
        code: 'member_voice_call_disabled',
      },
    );
  });

  it('handleCallRequest allows guest caller when only member calls are disabled', async () => {
    const {
      activeCalls,
      callerUsername,
      emitByTarget,
      gateway,
      targetUsername,
      userActiveCalls,
    } =
      createCallGateway({
        callerIsGuest: true,
        targetIsGuest: false,
        membersVoiceCallEnabled: false,
        guestVoiceCallEnabled: true,
      });

    await expect(
      gateway.handleCallRequest(
        {
          targetUsername,
          callerUsername,
          callerIsGuest: true,
          tenantId: 'tenant_master',
          callId: 'call-guest-to-member-disabled',
        } as any,
        { id: 'caller-socket', username: callerUsername } as any,
      ),
    ).resolves.toEqual({ status: 'ok' });

    expect(emitByTarget.get('target-socket')).toHaveBeenCalledWith(
      'call:incoming',
      expect.objectContaining({
        callId: 'call-guest-to-member-disabled',
        fromIsGuest: true,
      }),
    );

    (gateway as any).clearActiveCall('call-guest-to-member-disabled');
    activeCalls.clear();
    userActiveCalls.clear();
  });

  it('handleCallRequest rings target when target type is enabled', async () => {
    const {
      activeCalls,
      callerUsername,
      emitByTarget,
      gateway,
      targetUsername,
      userActiveCalls,
    } = createCallGateway({
      callerIsGuest: false,
      targetIsGuest: true,
      membersVoiceCallEnabled: true,
      guestVoiceCallEnabled: true,
    });

    await expect(
      gateway.handleCallRequest(
        {
          targetUsername,
          callerUsername,
          callerIsGuest: false,
          tenantId: 'tenant_master',
          callId: 'call-enabled',
          callType: 'voice',
        } as any,
        { id: 'caller-socket', username: callerUsername } as any,
      ),
    ).resolves.toEqual({ status: 'ok' });

    expect(emitByTarget.get('target-socket')).toHaveBeenCalledWith(
      'call:incoming',
      expect.objectContaining({
        callId: 'call-enabled',
        callType: 'voice',
        fromUsername: callerUsername,
        fromIsGuest: false,
      }),
    );

    (gateway as any).clearActiveCall('call-enabled');
    activeCalls.clear();
    userActiveCalls.clear();
  });

  it('handleCallRequest matches the requested agent nickname identity', async () => {
    const {
      activeCalls,
      callerUsername,
      emitByTarget,
      gateway,
      targetUsername,
      userActiveCalls,
    } = createCallGateway({
      callerAgentNickname: 'Caller Mask',
      targetAgentNickname: 'Target Mask',
      membersVoiceCallEnabled: true,
      guestVoiceCallEnabled: true,
    });

    await expect(
      gateway.handleCallRequest(
        {
          targetUsername,
          targetAgentNickname: 'Target Mask',
          callerUsername,
          callerAgentNickname: 'Caller Mask',
          callerIsGuest: false,
          tenantId: 'tenant_master',
          callId: 'call-agent-enabled',
          callType: 'video',
        } as any,
        { id: 'caller-socket', username: callerUsername } as any,
      ),
    ).resolves.toEqual({ status: 'ok' });

    expect(emitByTarget.get('target-socket')).toHaveBeenCalledWith(
      'call:incoming',
      expect.objectContaining({
        callId: 'call-agent-enabled',
        callType: 'video',
        fromUsername: 'Caller Mask (member-caller)',
        fromIsGuest: true,
      }),
    );

    (gateway as any).clearActiveCall('call-agent-enabled');
    activeCalls.clear();
    userActiveCalls.clear();
  });

  it('emits active system reset with remaining countdown to new connections', () => {
    const { gateway, server } = createGateway();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);

    gateway.emitSystemResetStarted({
      countdownSeconds: 10,
      message: 'Sistem resetleniyor',
    });

    const client = { id: 'new-socket', emit: jest.fn() };
    dateNowSpy.mockReturnValue(4_400);

    gateway.handleConnection(client as any);

    expect(server.emit).toHaveBeenCalledWith('system:resetStarted', {
      countdownSeconds: 10,
      remainingDurationMs: 30000,
      message: 'Sistem resetleniyor',
      timestamp: new Date(1_000).toISOString(),
    });
    expect(client.emit).toHaveBeenCalledWith('system:resetStarted', {
      countdownSeconds: 9,
      remainingDurationMs: 26600,
      message: 'Sistem resetleniyor',
      timestamp: new Date(1_000).toISOString(),
    });
    dateNowSpy.mockRestore();
  });

  it('blocks joinRoom during reset even when reset started from another gateway instance', async () => {
    const { gateway: resetGateway } = createGateway();
    const { gateway: joinGateway } = createGateway();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);

    resetGateway.emitSystemResetStarted({
      countdownSeconds: 10,
      message: 'Sistem resetleniyor',
    });

    const client = {
      id: 'join-socket',
      emit: jest.fn(),
    };
    dateNowSpy.mockReturnValue(6_100);

    await expect(
      joinGateway.handleJoin(
        {
          room: 'lobby',
          roomName: 'Lobby',
          username: 'target',
          gender: 'male',
          tenantId: 'tenant_master',
        } as any,
        client as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      room: 'lobby',
      roomName: 'Lobby',
      message: 'reset_in_progress',
      detail: 'Sistem resetlenirken giriş yapılamaz.',
      countdownSeconds: 9,
      remainingDurationMs: 24900,
    });

    expect(client.emit).toHaveBeenCalledWith('system:resetStarted', {
      countdownSeconds: 9,
      remainingDurationMs: 24900,
      message: 'Sistem resetleniyor',
      timestamp: new Date(1_000).toISOString(),
    });
    expect(client.emit).toHaveBeenCalledWith('room:joinError', {
      room: 'lobby',
      roomName: 'Lobby',
      message: 'reset_in_progress',
      detail: 'Sistem resetlenirken giriş yapılamaz.',
      countdownSeconds: 9,
      remainingDurationMs: 24900,
    });
    dateNowSpy.mockRestore();
  });

  it('does not emit fully expired system reset to new connections', () => {
    const { gateway } = createGateway();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);

    gateway.emitSystemResetStarted({
      countdownSeconds: 10,
      message: 'Sistem resetleniyor',
    });

    const client = { id: 'late-socket', emit: jest.fn() };
    dateNowSpy.mockReturnValue(31_001);

    gateway.handleConnection(client as any);

    expect(client.emit).not.toHaveBeenCalledWith(
      'system:resetStarted',
      expect.anything(),
    );
    dateNowSpy.mockRestore();
  });

  it('handleModerationToggleRoomMute should return target_is_protected for protected DB user', async () => {
    const { gateway } = createGateway();

    await expect(
      gateway.handleModerationToggleRoomMute(
        { room: 'lobby', targetUsername: 'target' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'target_is_protected',
    });
  });

  it('handleModerationDropFromMic should return target_is_protected for protected DB user', async () => {
    const { gateway } = createGateway();

    await expect(
      gateway.handleModerationDropFromMic(
        { room: 'lobby', targetUsername: 'target' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'target_is_protected',
    });
  });

  it('handleModerationToggleRoomMute should reject when sender lacks Mikrofon Engelle Yetkisi', async () => {
    const { gateway } = createGateway({
      senderPersistedUser: {
        username: 'admin',
        permissions: [],
        role: { starCount: 2, permissions: {} },
      },
    });

    await expect(
      gateway.handleModerationToggleRoomMute(
        { room: 'lobby', targetUsername: 'target' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'insufficient_privileges',
    });
  });

  it('handleModerationDropFromMic should reject when sender lacks Mikrofon Engelle Yetkisi', async () => {
    const { gateway } = createGateway({
      senderPersistedUser: {
        username: 'admin',
        permissions: [],
        role: { starCount: 2, permissions: {} },
      },
    });

    await expect(
      gateway.handleModerationDropFromMic(
        { room: 'lobby', targetUsername: 'target' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'insufficient_privileges',
    });
  });

  it('handleModerationToggleGlobalMute should reject when sender lacks Mikrofon Engelle Yetkisi', async () => {
    const { gateway } = createGateway({
      senderPersistedUser: {
        username: 'admin',
        permissions: [],
        role: { starCount: 2, permissions: {} },
      },
    });

    await expect(
      gateway.handleModerationToggleGlobalMute(
        { targetUsername: 'target' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'insufficient_privileges',
    });
  });

  it('handleModerationTempOperatorGrant should reject when sender lacks Geçici Operatörlük Verme', async () => {
    const { gateway, roomMembers } = createGateway({
      senderPersistedUser: {
        username: 'admin',
        permissions: [],
        role: { starCount: 2, permissions: {} },
      },
    });
    const target = roomMembers.get('lobby')?.get('target');
    if (target) {
      target.roleStarCount = 0;
    }

    await expect(
      gateway.handleModerationTempOperatorGrant(
        { targetUsername: 'target' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      code: 'insufficient_privileges',
    });
  });

  it('handleModerationTempOperatorRevoke should reject when sender lacks Geçici Operatörlük Verme', async () => {
    const { gateway, roomMembers } = createGateway({
      senderPersistedUser: {
        username: 'admin',
        permissions: [],
        role: { starCount: 2, permissions: {} },
      },
    });
    const target = roomMembers.get('lobby')?.get('target');
    if (target) {
      target.roleStarCount = 0;
    }

    await gateway.handleModerationTempOperatorGrant(
      { targetUsername: 'target' } as any,
      { id: 'sender-socket', username: 'root' } as any,
    );

    await expect(
      gateway.handleModerationTempOperatorRevoke(
        { targetUsername: 'target' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      code: 'insufficient_privileges',
    });
  });

  it('handleModerationTempOperatorGrant should allow when sender has Geçici Operatörlük Verme', async () => {
    const { gateway, roomMembers } = createGateway({
      senderPersistedUser: {
        username: 'admin',
        permissions: ['Geçici Operatörlük Verme'],
        role: { starCount: 2, permissions: {} },
      },
    });
    const target = roomMembers.get('lobby')?.get('target');
    if (target) {
      target.roleStarCount = 0;
    }

    await expect(
      gateway.handleModerationTempOperatorGrant(
        { targetUsername: 'target' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'ok',
    });
  });

  it('handleModerationUserInfoRequest should mask IP when sender lacks İp Görme Yetkisi', async () => {
    const { gateway } = createGateway({
      senderPersistedUser: {
        username: 'admin',
        permissions: [],
        role: { starCount: 2, permissions: {} },
      },
    });

    await expect(
      gateway.handleModerationUserInfoRequest(
        { targetUsername: 'target' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        data: expect.objectContaining({
          ipAddress: 'Gizli',
        }),
      }),
    );
  });

  it('handleModerationUserInfoRequest should return ip_not_available when sender has İp Görme Yetkisi but target IP is missing', async () => {
    const { gateway } = createGateway({
      senderPersistedUser: {
        username: 'admin',
        permissions: ['İp Görme Yetkisi'],
        role: { starCount: 2, permissions: {} },
      },
    });

    await expect(
      gateway.handleModerationUserInfoRequest(
        { targetUsername: 'target' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      code: 'ip_not_available',
    });
  });

  it('handleTeleport should return target_is_protected for protected DB user', async () => {
    const { gateway } = createGateway();

    await expect(
      gateway.handleTeleport(
        { targetUsername: 'target', roomName: 'VIP' },
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'target_is_protected',
    });
  });

  it('handleModerationMicInvite should return target_is_protected for protected DB user', async () => {
    const { gateway } = createGateway();

    await expect(
      gateway.handleModerationMicInvite(
        { targetUsername: 'target', room: 'lobby', roomName: 'Lobby' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      code: 'target_is_protected',
    });
  });

  it('handleModerationMicInvite should reject when sender lacks Mikrofon Daveti', async () => {
    const { gateway } = createGateway({
      senderPersistedUser: {
        username: 'admin',
        permissions: ['Mikrofon Engelle Yetkisi'],
        role: { starCount: 2, permissions: {} },
      },
    });

    await expect(
      gateway.handleModerationMicInvite(
        { targetUsername: 'target', room: 'lobby', roomName: 'Lobby' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      code: 'insufficient_privileges',
    });
  });

  it('handleRoomInvite should emit and return target_is_protected for protected DB user', async () => {
    const { gateway, server } = createGateway();

    await expect(
      gateway.handleRoomInvite(
        { targetUsername: 'target', roomName: 'VIP' } as any,
        { id: 'sender-socket', username: 'admin' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'target_is_protected',
    });

    expect(server.to).toHaveBeenCalledWith('sender-socket');
    expect(server.to.mock.results[0].value.emit).toHaveBeenCalledWith(
      'room:invite:result',
      expect.objectContaining({
        status: 'error',
        code: 'target_is_protected',
        targetUsername: 'target',
      }),
    );
  });

  it('handleJoin should allow entry when room minStar is zero and user star is zero', async () => {
    const { gateway, roomMembers, toEmit, userQueryBuilder } = createJoinGateway({
      roomMinStar: 0,
      aiBot: {
        id: 10,
        username: 'ai-welcome',
        room: 'lobi',
        isAI: true,
        welcomeMessage: 'Merhaba [username]',
        welcomeManualPromptEnabled: true,
      },
      joinUser: { username: 'member', role: { starCount: 0 } },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'member',
        guest: false,
        roleStarCount: 99,
      } as any,
      client as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        room: 'lobby',
        username: 'member',
        roleStarCount: 0,
      }),
    );
    expect(client.join).toHaveBeenCalledWith('lobby');
    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:userJoined',
      expect.objectContaining({
        room: 'lobby',
        username: 'member',
        entryType: 'site',
      }),
    );
    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:welcomePromptRequested',
      expect.objectContaining({
        room: 'lobby',
        username: 'member',
        entryType: 'site',
      }),
    );
    expect(roomMembers.get('lobby')?.get('member')).toEqual(
      expect.objectContaining({
        socketId: 'join-socket',
        roleStarCount: 0,
      }),
    );
    expect(userQueryBuilder.getOne).toHaveBeenCalled();
  });

  it('handleJoin should emit room entryType when user switches rooms', async () => {
    const { gateway, roomMembers, toEmit } = createJoinGateway({
      roomMinStar: 0,
      joinUser: { username: 'member', role: { starCount: 0 } },
    });
    roomMembers.set(
      'old-room',
      new Map([
        [
          'member',
          {
            socketId: 'join-socket',
            username: 'member',
            gender: 'male',
            isGuest: false,
            roleStarCount: 0,
            tenantId: 'tenant_master',
          },
        ],
      ]),
    );

    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    await expect(
      gateway.handleJoin(
        {
          room: 'lobby',
          roomName: 'Lobby',
          username: 'member',
          guest: false,
          isTeleport: true,
        } as any,
        client as any,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        room: 'lobby',
        username: 'member',
      }),
    );

    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:userJoined',
      expect.objectContaining({
        room: 'lobby',
        username: 'member',
        entryType: 'room',
      }),
    );
    expect(toEmit.emit).not.toHaveBeenCalledWith(
      'room:welcomePromptRequested',
      expect.anything(),
    );
  });

  it('handleJoin should match tenant_master payloads with master room presence', async () => {
    const { gateway, roomMembers, toEmit, server } = createJoinGateway({
      roomMinStar: 0,
      joinUser: { username: 'member', role: { starCount: 0 } },
    });
    roomMembers.set(
      'old-room',
      new Map([
        [
          'member',
          {
            socketId: 'old-tenant-socket',
            username: 'member',
            loginHistoryId: 456,
            gender: 'male',
            isGuest: false,
            roleStarCount: 0,
            tenantId: 'master',
          },
        ],
      ]),
    );
    server.sockets.sockets.set('old-tenant-socket', {
      connected: true,
    } as any);

    const client = {
      id: 'new-tenant-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'member',
        guest: false,
        tenantId: 'tenant_master',
        loginHistoryId: 456,
      } as any,
      client as any,
    );

    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:userJoined',
      expect.objectContaining({
        room: 'lobby',
        username: 'member',
        tenantId: 'master',
        entryType: 'room',
      }),
    );
    expect(toEmit.emit).not.toHaveBeenCalledWith(
      'room:welcomePromptRequested',
      expect.anything(),
    );
  });

  it('handleJoin should send automatic AI welcome again after page refresh', async () => {
    const { gateway, server, toEmit } = createJoinGateway({
      roomMinStar: 0,
      aiBot: {
        id: 10,
        username: 'ai-welcome',
        room: 'Lobi',
        isAI: true,
        welcomeMessage: 'Merhaba [username]',
        welcomeManualPromptEnabled: false,
        welcomeAutoSendEnabled: true,
      },
      joinUser: { username: 'member', role: { starCount: 0 } },
    });
    const firstClient = {
      id: 'first-refresh-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };
    const secondClient = {
      id: 'second-refresh-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    server.sockets.sockets.set('first-refresh-socket', { id: 'first-refresh-socket' } as any);
    server.sockets.sockets.set('second-refresh-socket', { id: 'second-refresh-socket' } as any);

    await gateway.handleJoin(
      { room: 'lobby', roomName: 'Lobby', username: 'member', guest: false } as any,
      firstClient as any,
    );
    gateway.handleDisconnect(firstClient as any);
    await gateway.handleJoin(
      { room: 'lobby', roomName: 'Lobby', username: 'member', guest: false } as any,
      secondClient as any,
    );

    const aiWelcomeMessages = toEmit.emit.mock.calls.filter(
      ([eventName, payload]) =>
        eventName === 'room:message' &&
        payload?.username === 'ai-welcome' &&
        payload?.message === 'Merhaba member',
    );
    expect(aiWelcomeMessages).toHaveLength(2);
  });

  it('handleJoin should send automatic AI welcome for online guests in lobby', async () => {
    const { gateway, toEmit } = createJoinGateway({
      roomMinStar: 0,
      aiBot: {
        id: 10,
        username: 'ai-welcome',
        room: 'Lobi',
        isAI: true,
        welcomeMessage: 'Merhaba [username]',
        welcomeManualPromptEnabled: false,
        welcomeAutoSendEnabled: true,
      },
      joinUser: null,
    });
    const client = {
      id: 'guest-join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'misafir',
        guest: true,
        statusModeName: 'Çevrimiçi',
      } as any,
      client as any,
    );

    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:message',
      expect.objectContaining({
        room: 'lobby',
        username: 'ai-welcome',
        message: 'Merhaba misafir',
      }),
    );
  });

  it('handleJoin should not send AI welcome while user is on roof mode', async () => {
    const { gateway, toEmit } = createJoinGateway({
      roomMinStar: 0,
      aiBot: {
        id: 10,
        username: 'ai-welcome',
        room: 'Lobi',
        isAI: true,
        welcomeMessage: 'Merhaba [username]',
        welcomeManualPromptEnabled: false,
        welcomeAutoSendEnabled: true,
      },
      joinUser: {
        username: 'staff',
        permissions: ['Çatı Girişi'],
        role: { starCount: 5, permissions: {} },
      },
    });
    const client = {
      id: 'staff-roof-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    await expect(
      gateway.handleJoin(
        {
          room: 'lobby',
          roomName: 'Lobby',
          username: 'staff',
          guest: false,
          statusModeName: 'Çatıda',
        } as any,
        client as any,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        statusModeName: 'Çatıda',
      }),
    );

    expect(toEmit.emit).not.toHaveBeenCalledWith(
      'room:message',
      expect.objectContaining({
        username: 'ai-welcome',
        message: 'Merhaba staff',
      }),
    );
    expect(toEmit.emit).not.toHaveBeenCalledWith(
      'room:welcomePromptRequested',
      expect.anything(),
    );
  });

  it('handleStatusModeUpdate should send AI welcome when user exits roof mode', async () => {
    const { gateway, roomMembers, server, toEmit } = createJoinGateway({
      roomMinStar: 0,
      aiBot: {
        id: 10,
        username: 'ai-welcome',
        room: 'Lobi',
        isAI: true,
        welcomeMessage: 'Merhaba [username]',
        welcomeManualPromptEnabled: false,
        welcomeAutoSendEnabled: true,
      },
      joinUser: {
        username: 'staff',
        permissions: ['Çatı Girişi'],
        role: { starCount: 5, permissions: {} },
      },
    });
    const client = {
      id: 'staff-roof-exit-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };
    roomMembers.set(
      'lobby',
      new Map([
        [
          'staff',
          {
            socketId: 'staff-roof-exit-socket',
            username: 'staff',
            gender: 'male',
            isGuest: false,
            tenantId: 'tenant_master',
            roleStarCount: 5,
            statusModeName: 'Çatıda',
          },
        ],
      ]),
    );
    server.sockets.sockets.set('staff-roof-exit-socket', {
      id: 'staff-roof-exit-socket',
    } as any);

    expect(roomMembers.get('lobby')?.get('staff')).toEqual(
      expect.objectContaining({
        statusModeName: 'Çatıda',
      }),
    );

    await gateway.handleStatusModeUpdate(
      {
        room: 'lobby',
        username: 'staff',
        statusModeName: 'Çevrimiçi',
      } as any,
      client as any,
    );

    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:message',
      expect.objectContaining({
        room: 'lobby',
        username: 'ai-welcome',
        message: 'Merhaba staff',
      }),
    );
  });

  it('handleJoin should suppress duplicate AI welcome for the same login history session', async () => {
    const { gateway, server, toEmit } = createJoinGateway({
      roomMinStar: 0,
      aiBot: {
        id: 10,
        username: 'ai-welcome',
        room: 'Lobi',
        isAI: true,
        welcomeMessage: 'Merhaba [username]',
        welcomeManualPromptEnabled: false,
        welcomeAutoSendEnabled: true,
      },
      joinUser: { username: 'member', role: { starCount: 0 } },
    });
    const firstClient = {
      id: 'first-session-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };
    const secondClient = {
      id: 'second-session-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    server.sockets.sockets.set('first-session-socket', {
      id: 'first-session-socket',
    } as any);
    server.sockets.sockets.set('second-session-socket', {
      id: 'second-session-socket',
    } as any);

    await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'member',
        guest: false,
        tenantId: 'tenant_master',
        loginHistoryId: 789,
      } as any,
      firstClient as any,
    );
    gateway.handleDisconnect(firstClient as any);
    await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'member',
        guest: false,
        tenantId: 'master',
        loginHistoryId: 789,
      } as any,
      secondClient as any,
    );

    const aiWelcomeMessages = toEmit.emit.mock.calls.filter(
      ([eventName, payload]) =>
        eventName === 'room:message' &&
        payload?.username === 'ai-welcome' &&
        payload?.message === 'Merhaba member',
    );
    expect(aiWelcomeMessages).toHaveLength(1);
  });

  it('handleJoin should not request AI welcome outside lobby', async () => {
    const { gateway, toEmit } = createJoinGateway({
      roomMinStar: 0,
      roomName: 'Sohbet',
      roomVoiceId: 'sohbet',
      aiBot: {
        id: 10,
        username: 'ai-welcome',
        room: 'lobby',
        isAI: true,
        welcomeMessage: 'Merhaba [username]',
        welcomeManualPromptEnabled: true,
      },
      joinUser: { username: 'member', role: { starCount: 0 } },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    await gateway.handleJoin(
      { room: 'sohbet', roomName: 'Sohbet', username: 'member', guest: false } as any,
      client as any,
    );

    expect(toEmit.emit).not.toHaveBeenCalledWith(
      'room:welcomePromptRequested',
      expect.anything(),
    );
  });

  it('handleJoin should label stale-presence joins as room entry for join effects', async () => {
    const { gateway, roomMembers, toEmit, server } = createJoinGateway({
      roomMinStar: 0,
      joinUser: { username: 'member', role: { starCount: 0 } },
    });
    roomMembers.set(
      'old-room',
      new Map([
        [
          'member',
          {
            socketId: 'old-refresh-socket',
            username: 'member',
            gender: 'male',
            isGuest: false,
            roleStarCount: 0,
            tenantId: 'tenant_master',
          },
        ],
      ]),
    );
    server.sockets.sockets.set('old-refresh-socket', {
      connected: true,
    } as any);

    const client = {
      id: 'new-refresh-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    await expect(
      gateway.handleJoin(
        {
          room: 'lobby',
          roomName: 'Lobby',
          username: 'member',
          guest: false,
          loginHistoryId: 123,
        } as any,
        client as any,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        room: 'lobby',
        username: 'member',
        entryType: 'room',
      }),
    );

    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:userJoined',
      expect.objectContaining({
        room: 'lobby',
        username: 'member',
        entryType: 'room',
      }),
    );
    expect(toEmit.emit).not.toHaveBeenCalledWith(
      'room:welcomePromptRequested',
      expect.anything(),
    );
  });

  it('handleJoin should label recent room leaves as room entry for join effects', async () => {
    const { gateway, roomMembers, toEmit } = createJoinGateway({
      roomMinStar: 0,
      joinUser: { username: 'member', role: { starCount: 0 } },
    });
    roomMembers.set(
      'old-room',
      new Map([
        [
          'member',
          {
            socketId: 'old-room-socket',
            username: 'member',
            loginHistoryId: 123,
            gender: 'male',
            isGuest: false,
            roleStarCount: 0,
            tenantId: 'tenant_master',
          },
        ],
      ]),
    );

    gateway.handleDisconnect({ id: 'old-room-socket' } as any);

    const client = {
      id: 'new-room-socket',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    await expect(
      gateway.handleJoin(
        {
          room: 'lobby',
          roomName: 'Lobby',
          username: 'member',
          guest: false,
          loginHistoryId: 123,
        } as any,
        client as any,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        room: 'lobby',
        username: 'member',
        entryType: 'room',
      }),
    );

    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:userJoined',
      expect.objectContaining({
        room: 'lobby',
        username: 'member',
        entryType: 'room',
      }),
    );
    expect(toEmit.emit).not.toHaveBeenCalledWith(
      'room:welcomePromptRequested',
      expect.anything(),
    );
  });

  it('handleJoin should reject entry when user star is lower than room minStar', async () => {
    const { gateway, roomMembers, server } = createJoinGateway({
      roomMinStar: 2,
      joinUser: { username: 'member', role: { starCount: 1 } },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'member',
        guest: false,
        roleStarCount: 99,
      } as any,
      client as any,
    );

    expect(result).toEqual({
      status: 'error',
      room: 'lobby',
      roomName: 'Lobby',
      message: 'minimum_star_required',
      detail: 'Bu odaya girmek için en az 2 yıldız gerekir.',
      requiredMinStar: 2,
      userStarCount: 1,
    });
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('room:joinError', {
      room: 'lobby',
      roomName: 'Lobby',
      message: 'minimum_star_required',
      detail: 'Bu odaya girmek için en az 2 yıldız gerekir.',
      requiredMinStar: 2,
      userStarCount: 1,
    });
    expect(roomMembers.has('lobby')).toBe(false);
    expect(server.to).not.toHaveBeenCalledWith('lobby');
  });

  it('handleJoin should allow entry when user star matches room minStar', async () => {
    const { gateway, roomMembers } = createJoinGateway({
      roomMinStar: 2,
      joinUser: { username: 'member', role: { starCount: 2 } },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'member',
        guest: false,
      } as any,
      client as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        roleStarCount: 2,
      }),
    );
    expect(client.join).toHaveBeenCalledWith('lobby');
    expect(roomMembers.get('lobby')?.get('member')).toEqual(
      expect.objectContaining({
        roleStarCount: 2,
      }),
    );
  });

  it('handleJoin should use persisted role visuals instead of stale socket payload for members', async () => {
    const { gateway, roomMembers } = createJoinGateway({
      joinUser: {
        username: 'member',
        role: {
          name: 'Yeni Rol',
          starCount: 2,
          starColor: '#22aa44',
          icon: 'crown',
          permissions: {},
        },
      },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'member',
        guest: false,
        roleName: 'Eski Rol',
        roleStarColor: '#ff0000',
        roleStarCount: 99,
        roleIcon: 'shield',
      } as any,
      client as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        roleName: 'Yeni Rol',
        roleStarColor: '#22aa44',
        roleStarCount: 2,
        roleIcon: 'crown',
      }),
    );
    expect(roomMembers.get('lobby')?.get('member')).toEqual(
      expect.objectContaining({
        roleName: 'Yeni Rol',
        roleStarColor: '#22aa44',
        roleStarCount: 2,
        roleIcon: 'crown',
      }),
    );
  });

  it('emitUserRoleChanged should include tenantId in the broadcast payload', () => {
    const { gateway, roomMembers, server } = createGateway();
    roomMembers.set(
      'vip',
      new Map([
        [
          'foreign-user',
          {
            socketId: 'foreign-socket',
            username: 'foreign-user',
            gender: 'male',
            isGuest: false,
            roleStarCount: 2,
            tenantId: 'other',
          },
        ],
      ]),
    );
    server.sockets.sockets.set('foreign-socket', { id: 'foreign-socket' });

    gateway.emitUserRoleChanged({
      userId: 2,
      username: 'member',
      tenantId: 'master',
      roleId: 10,
      role: {
        id: 10,
        name: 'Moderator',
        starCount: 2,
        starColor: '#ffcc00',
        icon: 'shield',
      },
    });

    expect(server.emit).toHaveBeenCalledWith(
      'user:roleChanged',
      expect.objectContaining({
        tenantId: 'master',
        userId: 2,
        username: 'member',
      }),
    );
  });

  it('updateUserRoleInAllRooms should update members even when the stored map key drifted from username', () => {
    const { gateway, roomMembers, server } = createGateway();
    const members = roomMembers.get('lobby')!;
    const targetMember = members.get('target')!;

    members.delete('target');
    members.set('legacy-target-key', {
      ...targetMember,
      username: 'Tamamen Farkli',
      roleName: 'Eski Rol',
      roleStarCount: 1,
      roleStarColor: '#111111',
      roleIcon: 'old-icon',
    });

    const emitRoomUsersSpy = jest.spyOn<any, any>(gateway as any, 'emitRoomUsers');
    const emitTenantSnapshotSpy = jest.spyOn<any, any>(
      gateway as any,
      'emitTenantActiveUserSnapshot',
    );

    gateway.updateUserRoleInAllRooms(
      'target',
      {
        name: 'Yeni Rol',
        starCount: 3,
        starColor: '#22aa44',
        icon: 'new-icon',
      },
      2,
    );

    expect(members.get('legacy-target-key')).toEqual(
      expect.objectContaining({
        username: 'Tamamen Farkli',
        userId: 2,
        roleName: 'Yeni Rol',
        roleStarCount: 3,
        roleStarColor: '#22aa44',
        roleIcon: 'new-icon',
      }),
    );
    expect(server.sockets.sockets.get('target-socket')).toEqual(
      expect.objectContaining({
        id: 'target-socket',
        roleStarCount: 3,
      }),
    );
    expect(emitRoomUsersSpy).toHaveBeenCalledWith('lobby');
    expect(emitTenantSnapshotSpy).toHaveBeenCalledWith('tenant_master');
  });

  it('notifyBotPresenceChanged should refresh both previous and current room users', () => {
    const { gateway, roomsState, server } = createGateway();
    roomsState.roomNames.set('voice_123', 'Voice Room');
    const emitRoomBotUsersSpy = jest
      .spyOn<any, any>(gateway as any, 'emitRoomBotUsers')
      .mockResolvedValue(undefined);
    const emitTenantSnapshotSpy = jest
      .spyOn<any, any>(gateway as any, 'emitTenantActiveUserSnapshot')
      .mockResolvedValue(undefined);

    gateway.notifyBotPresenceChanged({
      type: 'updated',
      username: 'bot-user',
      previousRoomKey: 'lobby',
      roomKey: 'voice_123',
    });

    expect(server.emit).toHaveBeenCalledWith('bot:updated', {
      type: 'updated',
      username: 'bot-user',
      previousRoomKey: 'lobby',
      roomKey: 'voice_123',
    });
    expect(emitRoomBotUsersSpy).toHaveBeenCalledWith('lobby');
    expect(emitRoomBotUsersSpy).toHaveBeenCalledWith('voice_123');
    expect(emitTenantSnapshotSpy).toHaveBeenCalledWith('tenant_master');
  });

  it('handleVoiceToggleMute should keep room member and socket presence mute state in sync', async () => {
    const { gateway, roomMembers, server, toEmit } = createGateway();
    const emitRoomUsersSpy = jest
      .spyOn<any, any>(gateway as any, 'emitRoomUsers')
      .mockResolvedValue(undefined);

    const targetMember = roomMembers.get('lobby')?.get('target') as any;
    targetMember.isInVoiceChat = true;
    targetMember.isMuted = false;

    const client = server.sockets.sockets.get('target-socket') as any;
    const result = await gateway.handleVoiceToggleMute(
      {
        room: 'lobby',
        username: 'target',
        isMuted: true,
      } as any,
      client,
    );

    expect(result).toEqual({ status: 'ok' });
    expect(targetMember.isMuted).toBe(true);
    expect(client.data.roomPresenceState).toEqual(
      expect.objectContaining({
        username: 'target',
        isInVoiceChat: true,
        isMuted: true,
      }),
    );
    expect(toEmit.emit).toHaveBeenCalledWith('voice:userMuted', {
      room: 'lobby',
      username: 'target',
      isMuted: true,
    });
    expect(server.emit).toHaveBeenCalledWith(
      'tenant:userStateUpdate',
      expect.objectContaining({
        username: 'target',
        isInVoiceChat: true,
        isMuted: true,
      }),
    );
    emitRoomUsersSpy.mockRestore();
  });

  it('handleVoiceToggleState should preserve unmuted voice state in later room snapshots', async () => {
    const { gateway, roomMembers, server } = createGateway();
    const emitRoomUsersSpy = jest
      .spyOn<any, any>(gateway as any, 'emitRoomUsers')
      .mockResolvedValue(undefined);

    const targetMember = roomMembers.get('lobby')?.get('target') as any;
    targetMember.isInVoiceChat = false;
    targetMember.isMuted = true;

    const client = server.sockets.sockets.get('target-socket') as any;
    const result = await gateway.handleVoiceToggleState(
      {
        room: 'lobby',
        username: 'target',
        isInVoiceChat: true,
        isMuted: false,
      } as any,
      client,
    );

    const snapshotUsers = (gateway as any).getRoomUsers('lobby');
    const targetSnapshot = snapshotUsers.find(
      (user: { username: string }) => user.username === 'target',
    );

    expect(result).toEqual({ status: 'ok' });
    expect(client.data.roomPresenceState).toEqual(
      expect.objectContaining({
        username: 'target',
        isInVoiceChat: true,
        isMuted: false,
      }),
    );
    expect(targetSnapshot).toEqual(
      expect.objectContaining({
        username: 'target',
        isInVoiceChat: true,
        isMuted: false,
      }),
    );
    emitRoomUsersSpy.mockRestore();
  });

  it('handleVoiceTakeSeat should allow up to five voice seats', async () => {
    const { gateway, roomMembers, server } = createGateway();
    jest
      .spyOn<any, any>(gateway as any, 'emitRoomUsers')
      .mockResolvedValue(undefined);

    const lobbyMembers = roomMembers.get('lobby')! as Map<string, any>;
    for (let index = 1; index <= 4; index += 1) {
      const username = `seat${index}`;
      const socketId = `${username}-socket`;
      lobbyMembers.set(username, {
        socketId,
        username,
        gender: 'male',
        isGuest: false,
        tenantId: 'tenant_master',
        isInVoiceChat: true,
        isInVoiceSeat: true,
        voiceSeatJoinedAt: index,
      });
      server.sockets.sockets.set(socketId, { id: socketId });
    }

    const targetMember = lobbyMembers.get('target') as any;
    targetMember.isInVoiceChat = true;
    targetMember.isInVoiceSeat = false;

    const client = server.sockets.sockets.get('target-socket') as any;
    const result = await gateway.handleVoiceTakeSeat(
      { room: 'lobby', username: 'target' } as any,
      client,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        isInVoiceSeat: true,
      }),
    );
    expect(targetMember.isInVoiceSeat).toBe(true);
    expect(typeof targetMember.voiceSeatJoinedAt).toBe('number');
    expect(client.data.roomPresenceState).toEqual(
      expect.objectContaining({
        username: 'target',
        isInVoiceSeat: true,
        voiceSeatJoinedAt: targetMember.voiceSeatJoinedAt,
      }),
    );
  });

  it('handleVoiceTakeSeat should store requested seat index', async () => {
    const { gateway, roomMembers, server } = createGateway();
    jest
      .spyOn<any, any>(gateway as any, 'emitRoomUsers')
      .mockResolvedValue(undefined);

    const targetMember = roomMembers.get('lobby')?.get('target') as any;
    targetMember.isInVoiceChat = true;
    targetMember.isMuted = true;

    const client = server.sockets.sockets.get('target-socket') as any;
    const result = await gateway.handleVoiceTakeSeat(
      { room: 'lobby', username: 'target', seatIndex: 3 } as any,
      client,
    );

    const snapshotUsers = (gateway as any).getRoomUsers('lobby');
    const targetSnapshot = snapshotUsers.find(
      (user: { username: string }) => user.username === 'target',
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        isInVoiceSeat: true,
        voiceSeatIndex: 3,
      }),
    );
    expect(targetMember.voiceSeatIndex).toBe(3);
    expect(targetMember.isMuted).toBe(true);
    expect(client.data.roomPresenceState).toEqual(
      expect.objectContaining({
        username: 'target',
        isInVoiceSeat: true,
        voiceSeatIndex: 3,
        isMuted: true,
      }),
    );
    expect(targetSnapshot).toEqual(
      expect.objectContaining({
        username: 'target',
        isInVoiceSeat: true,
        voiceSeatIndex: 3,
        isMuted: true,
      }),
    );
  });

  it('handleRoomUsersSnapshot should return current voice seat fields', async () => {
    const { gateway, roomMembers, server } = createGateway();
    const targetMember = roomMembers.get('lobby')?.get('target') as any;
    targetMember.isInVoiceChat = true;
    targetMember.isInVoiceSeat = true;
    targetMember.voiceSeatJoinedAt = 12345;
    targetMember.voiceSeatIndex = 2;

    const client = {
      id: 'viewer-socket',
      emit: jest.fn(),
    } as any;
    server.sockets.sockets.set('viewer-socket', client);

    const result = await gateway.handleRoomUsersSnapshot(
      { room: 'lobby' },
      client,
    );

    expect(client.emit).toHaveBeenCalledWith('room:users', {
      room: 'lobby',
      users: expect.arrayContaining([
        expect.objectContaining({
          username: 'target',
          isInVoiceChat: true,
          isInVoiceSeat: true,
          voiceSeatJoinedAt: 12345,
          voiceSeatIndex: 2,
        }),
      ]),
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        room: 'lobby',
        users: expect.arrayContaining([
          expect.objectContaining({
            username: 'target',
            isInVoiceSeat: true,
            voiceSeatIndex: 2,
          }),
        ]),
      }),
    );
  });

  it('handleVoiceTakeSeat should move an existing seat without changing mute state', async () => {
    const { gateway, roomMembers, server } = createGateway();
    jest
      .spyOn<any, any>(gateway as any, 'emitRoomUsers')
      .mockResolvedValue(undefined);

    const targetMember = roomMembers.get('lobby')?.get('target') as any;
    targetMember.isInVoiceChat = true;
    targetMember.isMuted = false;
    targetMember.isInVoiceSeat = true;
    targetMember.voiceSeatJoinedAt = 123;
    targetMember.voiceSeatIndex = 1;

    const client = server.sockets.sockets.get('target-socket') as any;
    const result = await gateway.handleVoiceTakeSeat(
      { room: 'lobby', username: 'target', seatIndex: 4 } as any,
      client,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        isInVoiceSeat: true,
        voiceSeatIndex: 4,
      }),
    );
    expect(targetMember.voiceSeatIndex).toBe(4);
    expect(targetMember.voiceSeatJoinedAt).toBe(123);
    expect(targetMember.isMuted).toBe(false);
    expect(client.data.roomPresenceState).toEqual(
      expect.objectContaining({
        username: 'target',
        isInVoiceSeat: true,
        voiceSeatIndex: 4,
        voiceSeatJoinedAt: 123,
        isMuted: false,
      }),
    );
  });

  it('handleVoiceTakeSeat should clear and reject roof users', async () => {
    const { gateway, roomMembers, server } = createGateway();
    jest
      .spyOn<any, any>(gateway as any, 'emitRoomUsers')
      .mockResolvedValue(undefined);

    const targetMember = roomMembers.get('lobby')?.get('target') as any;
    targetMember.statusModeName = 'Çatıda';
    targetMember.isInVoiceChat = true;
    targetMember.isMuted = false;
    targetMember.isInVoiceSeat = true;
    targetMember.voiceSeatJoinedAt = 123;
    targetMember.voiceSeatIndex = 2;

    const client = server.sockets.sockets.get('target-socket') as any;
    const result = await gateway.handleVoiceTakeSeat(
      { room: 'lobby', username: 'target', seatIndex: 2 } as any,
      client,
    );

    const snapshotUsers = (gateway as any).getRoomUsers('lobby');
    const targetSnapshot = snapshotUsers.find(
      (user: { username: string }) => user.username === 'target',
    );

    expect(result).toEqual({ status: 'error', message: 'on_roof' });
    expect(targetMember.isInVoiceSeat).toBe(false);
    expect(targetMember.voiceSeatJoinedAt).toBeUndefined();
    expect(targetMember.voiceSeatIndex).toBeUndefined();
    expect(targetSnapshot).toEqual(
      expect.objectContaining({
        username: 'target',
        isInVoiceSeat: false,
        voiceSeatJoinedAt: undefined,
        voiceSeatIndex: undefined,
      }),
    );
  });

  it('handleVoiceTakeSeat should reject the sixth voice seat without blocking voice chat', async () => {
    const { gateway, roomMembers, server } = createGateway();
    jest
      .spyOn<any, any>(gateway as any, 'emitRoomUsers')
      .mockResolvedValue(undefined);

    const lobbyMembers = roomMembers.get('lobby')! as Map<string, any>;
    for (let index = 1; index <= 5; index += 1) {
      const username = `seat${index}`;
      const socketId = `${username}-socket`;
      lobbyMembers.set(username, {
        socketId,
        username,
        gender: 'male',
        isGuest: false,
        tenantId: 'tenant_master',
        isInVoiceChat: true,
        isInVoiceSeat: true,
        voiceSeatJoinedAt: index,
      });
      server.sockets.sockets.set(socketId, { id: socketId });
    }

    const targetMember = lobbyMembers.get('target') as any;
    targetMember.isInVoiceChat = true;
    targetMember.isMuted = false;
    targetMember.isInVoiceSeat = false;

    const client = server.sockets.sockets.get('target-socket') as any;
    const result = await gateway.handleVoiceTakeSeat(
      { room: 'lobby', username: 'target' } as any,
      client,
    );

    expect(result).toEqual({ status: 'error', message: 'voice_seats_full' });
    expect(targetMember.isInVoiceSeat).toBe(false);
    expect(targetMember.isInVoiceChat).toBe(true);
    expect(targetMember.isMuted).toBe(false);
  });

  it('handleVoiceReleaseSeat should clear only the seat state', async () => {
    const { gateway, roomMembers, server } = createGateway();
    jest
      .spyOn<any, any>(gateway as any, 'emitRoomUsers')
      .mockResolvedValue(undefined);

    const targetMember = roomMembers.get('lobby')?.get('target') as any;
    targetMember.isInVoiceChat = true;
    targetMember.isMuted = false;
    targetMember.isInVoiceSeat = true;
    targetMember.voiceSeatJoinedAt = 123;
    targetMember.voiceSeatIndex = 2;

    const client = server.sockets.sockets.get('target-socket') as any;
    const result = await gateway.handleVoiceReleaseSeat(
      { room: 'lobby', username: 'target' } as any,
      client,
    );

    const snapshotUsers = (gateway as any).getRoomUsers('lobby');
    const targetSnapshot = snapshotUsers.find(
      (user: { username: string }) => user.username === 'target',
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        isInVoiceSeat: false,
        isInVoiceChat: true,
      }),
    );
    expect(targetMember.isInVoiceSeat).toBe(false);
    expect(targetMember.voiceSeatJoinedAt).toBeUndefined();
    expect(targetMember.voiceSeatIndex).toBeUndefined();
    expect(targetMember.isInVoiceChat).toBe(true);
    expect(targetMember.isMuted).toBe(false);
    expect(targetSnapshot).toEqual(
      expect.objectContaining({
        username: 'target',
        isInVoiceChat: true,
        isInVoiceSeat: false,
      }),
    );
  });

	  it('handleJoin should reject guest users when room minStar is greater than zero', async () => {
    const { gateway, roomMembers, userQueryBuilder } = createJoinGateway({
      roomMinStar: 2,
      joinUser: { username: 'guest-user', role: { starCount: 5 } },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'guest-user',
        guest: true,
      } as any,
      client as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'minimum_star_required',
        requiredMinStar: 2,
        userStarCount: 0,
      }),
    );
    expect(client.join).not.toHaveBeenCalled();
    expect(roomMembers.has('lobby')).toBe(false);
	    expect(userQueryBuilder.getOne).not.toHaveBeenCalled();
	  });

	  it('handleJoin should assign sequential guest aliases when guest system is enabled', async () => {
	    const { gateway, roomMembers, server } = createJoinGateway({
	      roomMinStar: 0,
	      guestSystemEnabled: true,
	    });
	    const makeClient = (id: string) => {
	      const client = {
	        id,
	        join: jest.fn().mockResolvedValue(undefined),
	        leave: jest.fn().mockResolvedValue(undefined),
	        emit: jest.fn(),
	        handshake: { headers: {}, address: '127.0.0.1' },
	      };
	      server.sockets.sockets.set(id, client);
	      return client;
	    };

	    await gateway.handleJoin(
	      {
	        room: 'lobby',
	        roomName: 'Lobby',
	        username: 'alpha',
	        guest: true,
	        gender: 'male',
	      } as any,
	      makeClient('guest-socket-1') as any,
	    );
	    await gateway.handleJoin(
	      {
	        room: 'lobby',
	        roomName: 'Lobby',
	        username: 'bravo',
	        guest: true,
	        gender: 'male',
	      } as any,
	      makeClient('guest-socket-2') as any,
	    );
	    await gateway.handleJoin(
	      {
	        room: 'lobby',
	        roomName: 'Lobby',
	        username: 'charlie',
	        guest: true,
	        gender: 'male',
	      } as any,
	      makeClient('guest-socket-3') as any,
	    );

	    const snapshot = await gateway.handleRoomUsersSnapshot(
	      { room: 'lobby' },
	      { id: 'viewer-socket', emit: jest.fn() } as any,
	    );

	    expect(roomMembers.get('lobby')?.get('alpha')).toEqual(
	      expect.objectContaining({ username: 'alpha', isGuest: true, guestAlias: 'guest1' }),
	    );
	    expect((snapshot as any).users).toEqual(
	      expect.arrayContaining([
	        expect.objectContaining({ username: 'alpha', displayUsername: 'guest1' }),
	        expect.objectContaining({ username: 'bravo', displayUsername: 'guest2' }),
	        expect.objectContaining({ username: 'charlie', displayUsername: 'guest3' }),
	      ]),
	    );
	  });

	  it('handleJoin should reuse freed guest alias numbers', async () => {
	    const { gateway, roomMembers, server } = createJoinGateway({
	      roomMinStar: 0,
	      guestSystemEnabled: true,
	    });
	    const makeClient = (id: string) => {
	      const client = {
	        id,
	        join: jest.fn().mockResolvedValue(undefined),
	        leave: jest.fn().mockResolvedValue(undefined),
	        emit: jest.fn(),
	        handshake: { headers: {}, address: '127.0.0.1' },
	      };
	      server.sockets.sockets.set(id, client);
	      return client;
	    };

	    await gateway.handleJoin(
	      { room: 'lobby', roomName: 'Lobby', username: 'alpha', guest: true } as any,
	      makeClient('guest-socket-1') as any,
	    );
	    await gateway.handleJoin(
	      { room: 'lobby', roomName: 'Lobby', username: 'bravo', guest: true } as any,
	      makeClient('guest-socket-2') as any,
	    );
	    roomMembers.get('lobby')?.delete('alpha');
	    server.sockets.sockets.delete('guest-socket-1');

	    await gateway.handleJoin(
	      { room: 'lobby', roomName: 'Lobby', username: 'delta', guest: true } as any,
	      makeClient('guest-socket-4') as any,
	    );

	    expect(roomMembers.get('lobby')?.get('delta')).toEqual(
	      expect.objectContaining({ username: 'delta', isGuest: true, guestAlias: 'guest1' }),
	    );
	  });

	  it('handleModerationGuestAliasRelease should reveal a guest real nickname for 1+ star users', async () => {
	    const { gateway, roomMembers } = createGateway();
	    const targetMember = roomMembers.get('lobby')?.get('target') as any;
	    targetMember.isGuest = true;
	    targetMember.guestAlias = 'guest1';
	    targetMember.guestAliasReleased = false;

	    const result = await gateway.handleModerationGuestAliasRelease(
	      { room: 'lobby', targetUsername: 'target' },
	      { id: 'sender-socket' } as any,
	    );

	    expect(result).toEqual(
	      expect.objectContaining({
	        status: 'ok',
	        username: 'target',
	        displayUsername: 'target',
	        isGuest: true,
	        guestAliasReleased: true,
	      }),
	    );
	    expect(targetMember).toEqual(
	      expect.objectContaining({
	        isGuest: true,
	        guestAlias: 'guest1',
	        guestAliasReleased: true,
	      }),
	    );
	  });

	  it('handleModerationGuestAliasRelease should reject users below 1 star', async () => {
	    const { gateway, roomMembers } = createGateway();
	    const senderMember = roomMembers.get('lobby')?.get('admin') as any;
	    const targetMember = roomMembers.get('lobby')?.get('target') as any;
	    senderMember.roleStarCount = 0;
	    targetMember.isGuest = true;
	    targetMember.guestAlias = 'guest1';
	    targetMember.guestAliasReleased = false;

	    const result = await gateway.handleModerationGuestAliasRelease(
	      { room: 'lobby', targetUsername: 'target' },
	      { id: 'sender-socket' } as any,
	    );

	    expect(result).toEqual({
	      status: 'error',
	      code: 'insufficient_privileges',
	    });
	    expect(targetMember.guestAliasReleased).toBe(false);
	  });

	  it('handleJoin should allow root to bypass room minStar', async () => {
    const { gateway, roomMembers, userQueryBuilder } = createJoinGateway({
      roomMinStar: 2,
      joinUser: { username: 'root', role: { starCount: 0 } },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'root',
        guest: false,
        roleStarCount: 7,
      } as any,
      client as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        roleStarCount: 7,
      }),
    );
    expect(client.join).toHaveBeenCalledWith('lobby');
    expect(roomMembers.get('lobby')?.get('root')).toEqual(
      expect.objectContaining({
        roleStarCount: 7,
      }),
    );
    expect(userQueryBuilder.getOne).not.toHaveBeenCalled();
  });

  it('handleStatusModeUpdate should reject roof mode when Çatı Girişi permission is missing', async () => {
    const { gateway } = createGateway();

    await expect(
      gateway.handleStatusModeUpdate(
        {
          room: 'lobby',
          username: 'target',
          statusModeId: 999,
          statusModeName: 'Çatıda',
        } as any,
        { id: 'target-socket', username: 'target' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'roof_permission_required',
    });
  });

  it('handleStatusModeUpdate should allow roof mode when user has Çatı Girişi permission', async () => {
    const { gateway } = createGateway({
      protectedUser: {
        username: 'target',
        protection: false,
        protectedByStarCount: 0,
        permissions: ['Çatı Girişi'],
        role: { starCount: 1 },
      },
    });

    await expect(
      gateway.handleStatusModeUpdate(
        {
          room: 'lobby',
          username: 'target',
          statusModeId: 999,
          statusModeName: 'Çatıda',
        } as any,
        { id: 'target-socket', username: 'target' } as any,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        room: 'lobby',
        username: 'target',
        statusModeId: 999,
        statusModeName: 'Çatıda',
      }),
    );
  });

  it('handleStatusModeUpdate should emit room:userJoinEffectTriggered to the room when user exits roof mode', async () => {
    const { gateway, roomMembers, server, toEmit } = createGateway({
      protectedUser: {
        username: 'target',
        protection: false,
        protectedByStarCount: 0,
        permissions: ['Çatı Girişi', 'Giriş efekti seçebilir'],
        role: { starCount: 1, permissions: {} },
        joinEffect: 'ocean-ribbon',
      },
    });

    const target = roomMembers.get('lobby')?.get('target');
    if (!target) {
      throw new Error('target room member missing');
    }

    target.statusModeId = 999;
    target.statusModeName = 'Çatıda';
    target.icon = 'avatar-7';
    target.roleIcon = '★';
    target.roleStarColor = '#ffd700';
    target.roleStarCount = 4;

    await expect(
      gateway.handleStatusModeUpdate(
        {
          room: 'lobby',
          username: 'target',
          statusModeId: 1,
          statusModeName: 'Çevrimiçi',
        } as any,
        { id: 'target-socket', username: 'target' } as any,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        previousStatusModeName: 'Çatıda',
        statusModeName: 'Çevrimiçi',
        joinEffect: 'ocean-ribbon',
      }),
    );

    expect(server.to).toHaveBeenCalledWith('lobby');
    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:userJoinEffectTriggered',
      expect.objectContaining({
        room: 'lobby',
        socketId: 'target-socket',
        username: 'target',
        statusModeId: 1,
        statusModeName: 'Çevrimiçi',
        icon: 'avatar-7',
        agentNickname: null,
        entryType: 'room',
        joinEffect: 'ocean-ribbon',
      }),
    );
    expect(server.emit).not.toHaveBeenCalledWith(
      'tenant:joinEffectTriggered',
      expect.anything(),
    );
  });

  it('handleStatusModeUpdate should preserve the live join effect when persisted user joinEffect is empty', async () => {
    const { gateway, roomMembers, server, toEmit } = createGateway({
      protectedUser: {
        username: 'target',
        protection: false,
        protectedByStarCount: 0,
        permissions: ['Çatı Girişi', 'Giriş efekti seçebilir'],
        role: { starCount: 1, permissions: {} },
      },
    });

    const target = roomMembers.get('lobby')?.get('target');
    if (!target) {
      throw new Error('target room member missing');
    }

    target.statusModeId = 999;
    target.statusModeName = 'Çatıda';
    target.joinEffect = 'ocean-ribbon';

    await expect(
      gateway.handleStatusModeUpdate(
        {
          room: 'lobby',
          username: 'target',
          statusModeId: 1,
          statusModeName: 'Çevrimiçi',
        } as any,
        { id: 'target-socket', username: 'target' } as any,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        previousStatusModeName: 'Çatıda',
        statusModeName: 'Çevrimiçi',
        joinEffect: 'ocean-ribbon',
      }),
    );

    expect(roomMembers.get('lobby')?.get('target')).toEqual(
      expect.objectContaining({
        joinEffect: 'ocean-ribbon',
      }),
    );
    expect(server.to).toHaveBeenCalledWith('lobby');
    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:userJoinEffectTriggered',
      expect.objectContaining({
        room: 'lobby',
        username: 'target',
        joinEffect: 'ocean-ribbon',
      }),
    );
  });

  it('syncUserStatusModeFromPersistence should not emit room join effects outside the room flow', async () => {
    const { gateway, roomMembers, server, toEmit } = createGateway();

    const target = roomMembers.get('lobby')?.get('target');
    if (!target) {
      throw new Error('target room member missing');
    }

    target.statusModeId = 999;
    target.statusModeName = 'Çatıda';
    target.joinEffect = 'ocean-ribbon';
    target.icon = 'avatar-9';
    target.roleIcon = '✦';
    target.roleStarColor = '#00ffff';
    target.roleStarCount = 2;

    await gateway.syncUserStatusModeFromPersistence({
      username: 'target',
      statusModeId: 1,
      statusModeName: 'Çevrimiçi',
      joinEffect: 'ocean-ribbon',
    });

    expect(toEmit.emit).not.toHaveBeenCalledWith(
      'room:userJoinEffectTriggered',
      expect.anything(),
    );
    expect(server.emit).not.toHaveBeenCalledWith(
      'tenant:joinEffectTriggered',
      expect.anything(),
    );
  });

  it('handleJoinEffectUpdate should reject when Giriş efekti seçebilir is missing', async () => {
    const { gateway } = createGateway();

    await expect(
      gateway.handleJoinEffectUpdate(
        {
          room: 'lobby',
          username: 'target',
          joinEffect: 'ocean-ribbon',
        } as any,
        { id: 'target-socket' } as any,
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'join_effect_permission_required',
    });
  });

  it('handleJoinEffectUpdate should allow when user has star and Giriş efekti seçebilir', async () => {
    const { gateway, roomMembers } = createGateway({
      protectedUser: {
        username: 'target',
        protection: false,
        protectedByStarCount: 0,
        permissions: ['Giriş efekti seçebilir'],
        role: { starCount: 1 },
      },
    });

    await expect(
      gateway.handleJoinEffectUpdate(
        {
          room: 'lobby',
          username: 'target',
          joinEffect: 'ocean-ribbon',
        } as any,
        { id: 'target-socket' } as any,
      ),
    ).resolves.toEqual({
      status: 'ok',
      username: 'target',
      joinEffect: 'ocean-ribbon',
    });
    expect(roomMembers.get('lobby')?.get('target')).toEqual(
      expect.objectContaining({
        joinEffect: 'ocean-ribbon',
      }),
    );
  });

  it('handleJoinEffectTrigger should emit room:userJoinEffectTriggered to the room', async () => {
    const { gateway, roomMembers, server, toEmit } = createGateway({
      protectedUser: {
        username: 'target',
        protection: false,
        protectedByStarCount: 0,
        permissions: ['Giriş efekti seçebilir'],
        role: { starCount: 1 },
      },
    });

    const lobbyTarget = roomMembers.get('lobby')?.get('target');
    if (!lobbyTarget) {
      throw new Error('target room member missing');
    }
    lobbyTarget.statusModeName = 'Çevrimiçi';
    lobbyTarget.joinEffect = 'ocean-ribbon';

    await expect(
      gateway.handleJoinEffectTrigger(
        {
          room: 'lobby',
          username: 'target',
          joinEffect: 'ocean-ribbon',
        } as any,
        { id: 'target-socket' } as any,
      ),
    ).resolves.toEqual({
      status: 'ok',
      username: 'target',
      joinEffect: 'ocean-ribbon',
    });

    expect(server.to).toHaveBeenCalledWith('lobby');
    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:userJoinEffectTriggered',
      expect.objectContaining({
        room: 'lobby',
        username: 'target',
        joinEffect: 'ocean-ribbon',
      }),
    );
    expect(server.emit).not.toHaveBeenCalledWith(
      'tenant:joinEffectTriggered',
      expect.anything(),
    );
  });

  it('handleJoin should reject meeting room entry when user has no Toplantı Yetkisi', async () => {
    const { gateway, roomMembers } = createJoinGateway({
      roomMinStar: 0,
      roomName: 'Toplantı Odası',
      joinUser: {
        username: 'member',
        permissions: [],
        role: { starCount: 5, permissions: {} },
      },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'toplanti-odasi',
        roomName: 'Toplantı Odası',
        username: 'member',
        guest: false,
      } as any,
      client as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'meeting_permission_required',
      }),
    );
    expect(client.join).not.toHaveBeenCalled();
    expect(roomMembers.has('toplanti-odasi')).toBe(false);
  });

  it('handleJoin should allow meeting room entry when user has Toplantı Yetkisi', async () => {
    const { gateway, roomMembers } = createJoinGateway({
      roomMinStar: 0,
      roomName: 'Toplantı Odası',
      joinUser: {
        username: 'member',
        permissions: ['Toplantı Yetkisi'],
        role: { starCount: 1, permissions: {} },
      },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'toplanti-odasi',
        roomName: 'Toplantı Odası',
        username: 'member',
        guest: false,
      } as any,
      client as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
      }),
    );
    expect(client.join).toHaveBeenCalledWith('toplanti-odasi');
    expect(roomMembers.get('toplanti-odasi')?.get('member')).toEqual(
      expect.objectContaining({
        roleStarCount: 1,
      }),
    );
  });

  it('handleJoin should emit join effect globally even when the user joins on roof mode', async () => {
    const { gateway, roomMembers, server, toEmit } = createJoinGateway({
      roomMinStar: 0,
      roomName: 'Lobby',
      joinUser: {
        username: 'member',
        permissions: ['Çatı Girişi', 'Giriş efekti seçebilir'],
        role: { starCount: 1, permissions: {} },
      },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'member',
        guest: false,
        statusModeName: 'Çatıda',
        joinEffect: 'ocean-ribbon',
      } as any,
      client as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        joinEffect: 'ocean-ribbon',
      }),
    );
    expect(roomMembers.get('lobby')?.get('member')).toEqual(
      expect.objectContaining({
        joinEffect: 'ocean-ribbon',
      }),
    );
    expect(server.emit).toHaveBeenCalledWith(
      'tenant:joinEffectTriggered',
      expect.objectContaining({
        room: 'lobby',
        username: 'member',
        entryType: 'site',
        joinEffect: 'ocean-ribbon',
      }),
    );
    expect(toEmit.emit).not.toHaveBeenCalledWith(
      'room:userJoinEffectTriggered',
      expect.anything(),
    );
  });

  it('handleJoin should normalize Çatıda to Çevrimiçi when user has no Çatı Girişi', async () => {
    const { gateway, roomMembers } = createJoinGateway({
      roomMinStar: 0,
      roomName: 'Lobby',
      joinUser: {
        username: 'member',
        permissions: [],
        role: { starCount: 3, permissions: {} },
      },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'member',
        guest: false,
        statusModeId: 999,
        statusModeName: 'Çatıda',
      } as any,
      client as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        statusModeName: 'Çevrimiçi',
      }),
    );
    expect(roomMembers.get('lobby')?.get('member')).toEqual(
      expect.objectContaining({
        statusModeName: 'Çevrimiçi',
      }),
    );
  });

  it('handleJoin should allow root to bypass meeting room permission', async () => {
    const { gateway } = createJoinGateway({
      roomMinStar: 0,
      roomName: 'Toplantı Odası',
      joinUser: {
        username: 'root',
        permissions: [],
        role: { starCount: 0, permissions: {} },
      },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'toplanti-odasi',
        roomName: 'Toplantı Odası',
        username: 'root',
        guest: false,
        roleStarCount: 5,
      } as any,
      client as any,
    );

    expect(result).toEqual(expect.objectContaining({ status: 'ok' }));
    expect(client.join).toHaveBeenCalledWith('toplanti-odasi');
  });

  it('handleJoin should keep legacy behavior when room cannot be found in DB', async () => {
    const { gateway, roomMembers, roomQueryBuilder } = createJoinGateway({
      roomMinStar: null,
      joinUser: { username: 'member', role: { starCount: 1 } },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'legacy-room',
        roomName: 'Legacy Room',
        username: 'member',
        guest: false,
      } as any,
      client as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        room: 'legacy-room',
        roleStarCount: 1,
      }),
    );
    expect(roomQueryBuilder.getOne).toHaveBeenCalled();
    expect(client.join).toHaveBeenCalledWith('legacy-room');
    expect(roomMembers.get('legacy-room')?.get('member')).toEqual(
      expect.objectContaining({
        roleStarCount: 1,
      }),
    );
  });

  it('handleJoin should look up room by roomName when room key is a slug', async () => {
    const { gateway, roomQueryBuilder } = createJoinGateway({
      roomMinStar: 19,
      joinUser: { username: 'member', role: { starCount: 15 } },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    await gateway.handleJoin(
      {
        room: 'vip-oda',
        roomName: 'VIP Oda',
        username: 'member',
        guest: false,
        roleStarCount: 27,
      } as any,
      client as any,
    );

    expect(roomQueryBuilder.where).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'room:joinError',
      expect.objectContaining({
        message: 'minimum_star_required',
        requiredMinStar: 19,
        userStarCount: 15,
      }),
    );
  });

  it('handleJoin should look up room by voiceId when payload room carries activeRoomId', async () => {
    const { gateway, roomQueryBuilder } = createJoinGateway({
      roomMinStar: 19,
      joinUser: { username: 'member', role: { starCount: 15 } },
    });
    roomQueryBuilder.getOne.mockResolvedValueOnce({
      id: 1,
      name: 'VIP Oda',
      voiceId: 'voice-room-19',
      minStar: 19,
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    await gateway.handleJoin(
      {
        room: 'voice-room-19',
        roomName: 'VIP Oda',
        username: 'member',
        guest: false,
        roleStarCount: 27,
      } as any,
      client as any,
    );

    expect(roomQueryBuilder.where).toHaveBeenCalledWith(
      expect.anything(),
    );
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'room:joinError',
      expect.objectContaining({
        message: 'minimum_star_required',
        requiredMinStar: 19,
        userStarCount: 15,
      }),
    );
  });

  it('handleJoin should prefer roomId when payload includes exact room id', async () => {
    const { gateway, roomRepository } = createJoinGateway({
      roomMinStar: null,
      joinUser: { username: 'member', role: { starCount: 15 } },
    });
    (roomRepository.findOne as jest.Mock).mockResolvedValueOnce({
      id: 44,
      name: 'VIP Oda',
      voiceId: 'voice-room-19',
      minStar: 19,
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    await gateway.handleJoin(
      {
        room: 'voice-room-19',
        roomId: 44,
        roomName: 'VIP Oda',
        username: 'member',
        guest: false,
      } as any,
      client as any,
    );

    expect(roomRepository.findOne).toHaveBeenCalledWith({
      where: { id: 44 },
    });
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'room:joinError',
      expect.objectContaining({
        message: 'minimum_star_required',
        requiredMinStar: 19,
        userStarCount: 15,
      }),
    );
  });

  it('handleJoin should ignore spoofed payload starCount and use DB starCount instead', async () => {
    const { gateway, roomMembers } = createJoinGateway({
      roomMinStar: 2,
      joinUser: { username: 'member', role: { starCount: 1 } },
    });
    const client = {
      id: 'join-socket',
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      handshake: { headers: {}, address: '127.0.0.1' },
    };

    const result = await gateway.handleJoin(
      {
        room: 'lobby',
        roomName: 'Lobby',
        username: 'member',
        guest: false,
        roleStarCount: 27,
      } as any,
      client as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'minimum_star_required',
        userStarCount: 1,
      }),
    );
    expect(client.join).not.toHaveBeenCalled();
    expect(roomMembers.has('lobby')).toBe(false);
  });

  it('handleMessage should broadcast target messages for master tenant members without requiring explicit tenantId', async () => {
    const { gateway, roomMembers, server, toEmit } = createGateway({
      senderPersistedUser: {
        username: 'admin',
        permissions: ['Genel Atma'],
        role: { starCount: 2, permissions: {} },
      },
    });
    const lobbyMembers = roomMembers.get('lobby')!;
    lobbyMembers.get('admin')!.tenantId = undefined;
    lobbyMembers.get('target')!.tenantId = undefined;
    lobbyMembers.set('guest', {
      socketId: 'guest-socket',
      username: 'guest',
      gender: 'male',
      isGuest: true,
      roleStarCount: 0,
      tenantId: undefined,
    });
    server.sockets.sockets.set('guest-socket', { id: 'guest-socket' });

    const client = { id: 'sender-socket' };

    await gateway.handleMessage(
      {
        room: 'lobby',
        username: 'admin',
        message: 'ÜYELERE: test',
        messageId: 42,
        targetGroup: 'members',
      } as any,
      client as any,
    );

    expect(server.to).toHaveBeenCalledWith('sender-socket');
    expect(server.to).toHaveBeenCalledWith('target-socket');
    expect(server.to).not.toHaveBeenCalledWith('guest-socket');
    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:message',
      expect.objectContaining({
        room: 'lobby',
        messageId: 42,
        id: 42,
        targetGroup: 'members',
      }),
    );
  });

  it('emitTenantWideMessage should dedupe duplicate socket-room emissions', () => {
    const { gateway, roomMembers, server, toEmit } = createGateway();
    const lobbyMembers = roomMembers.get('lobby')!;
    lobbyMembers.set('admin-shadow', {
      ...lobbyMembers.get('admin')!,
      username: 'admin-shadow',
      socketId: 'sender-socket',
      tenantId: 'tenant_master',
    });

    (gateway as any).emitTenantWideMessage(
      'tenant_master',
      'everyone',
      (roomKey: string) => ({ room: roomKey, message: 'ping' }),
    );

    const senderCalls = (server.to as jest.Mock).mock.calls.filter(
      ([socketId]) => socketId === 'sender-socket',
    );
    expect(senderCalls).toHaveLength(1);
    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:message',
      expect.objectContaining({
        room: 'lobby',
        message: 'ping',
      }),
    );
  });

  it('emitTenantWideMessage should match prefixed and normalized tenant ids', async () => {
    const { gateway, roomMembers, server, toEmit } = createGateway({
      senderPersistedUser: {
        username: 'admin',
        permissions: ['Genel Atma'],
        role: { starCount: 2, permissions: {} },
      },
    });
    const lobbyMembers = roomMembers.get('lobby')!;
    lobbyMembers.get('admin')!.tenantId = 'master';
    lobbyMembers.get('target')!.tenantId = 'tenant_master' as any;

    const client = { id: 'sender-socket' };

    await gateway.handleMessage(
      {
        room: 'lobby',
        username: 'admin',
        message: 'HERKESE: test',
        messageId: 77,
        targetGroup: 'everyone',
      } as any,
      client as any,
    );

    expect(server.to).toHaveBeenCalledWith('target-socket');
    expect(toEmit.emit).toHaveBeenCalledWith(
      'room:message',
      expect.objectContaining({
        id: 77,
        messageId: 77,
        targetGroup: 'everyone',
      }),
    );
  });
});
