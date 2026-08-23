import { MessagesService } from './messages.service';
import { MessageClear } from './entities/message-clear.entity';

describe('MessagesService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const visibleHistoryFilter =
    '(messageClear.id IS NULL OR (messageClear.lastClearedMessageId IS NOT NULL AND message.id > messageClear.lastClearedMessageId) OR (messageClear.lastClearedMessageId IS NULL AND message.createdAt >= messageClear.clearedAt))';
  const activeVisibilitySessionFilter =
    'visibilitySession."leftMessageId" IS NULL AND visibilitySession."socketId" IN (:...activeVisibilitySocketIds)';

  const createQueryBuilderMock = () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    return queryBuilder;
  };

  it('findAll should apply visible-history filter', async () => {
    const queryBuilder = createQueryBuilderMock();
    const messageRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const service = new MessagesService(
      messageRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.findAll(42);

    expect(messageRepository.createQueryBuilder).toHaveBeenCalledWith('message');
    expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
      MessageClear,
      'messageClear',
      'messageClear.userId = :userId AND messageClear.roomId = message.roomId AND messageClear.identityKey = :identityKey',
      { userId: 42, identityKey: 'u:42:normal' },
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      '1 = 1',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      visibleHistoryFilter,
    );
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('senderIdentityKey'),
      expect.anything(),
    );
  });

  it('findAll should limit room history to active sessions when room history preference is off', async () => {
    const queryBuilder = createQueryBuilderMock();
    const messageRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 42,
        chatPreferences: { keepRoomChatHistory: false },
      }),
    };
    const roomsState = {
      rooms: new Map([
        [
          'lobby',
          new Map([
            ['busra', { socketId: 'socket-1' }],
          ]),
        ],
      ]),
    };

    const service = new MessagesService(
      messageRepository as any,
      {} as any,
      userRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      roomsState as any,
    );

    await service.findAll(42);

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 42 },
      select: ['id', 'chatPreferences'],
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining(activeVisibilitySessionFilter),
      {
        userId: 42,
        identityKey: 'u:42:normal',
        activeVisibilitySocketIds: ['socket-1'],
      },
    );
  });

  it('findAll should ignore cleared-history filter when requested', async () => {
    const queryBuilder = createQueryBuilderMock();
    const messageRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const service = new MessagesService(
      messageRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.findAll(42, 'lobby', undefined, true);

    expect(queryBuilder.leftJoin).not.toHaveBeenCalledWith(
      MessageClear,
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      visibleHistoryFilter,
    );
  });

  it('clearHistory should store the last existing message id as the clear boundary', async () => {
    const messageRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 99 }),
    };
    const roomRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 12, name: 'Lobby' }),
    };
    const messageClearRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const service = new MessagesService(
      messageRepository as any,
      roomRepository as any,
      {} as any,
      {} as any,
      messageClearRepository as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.clearHistory('  Lobby  ', 42);

    expect(messageRepository.findOne).toHaveBeenCalledWith({
      where: { roomId: 12 },
      order: { id: 'DESC' },
      select: ['id'],
    });
    expect(messageClearRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        roomId: 12,
        identityKey: 'u:42:normal',
        lastClearedMessageId: 99,
      }),
    );
    expect(messageClearRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lastClearedMessageId: 99,
      }),
    );
  });

  it('findAll should trim roomName filter', async () => {
    const queryBuilder = createQueryBuilderMock();
    const messageRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const roomRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    };
    const messageClearRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const service = new MessagesService(
      messageRepository as any,
      roomRepository as any,
      {} as any,
      {} as any,
      messageClearRepository as any,
      {} as any,
      {} as any,
      { rooms: new Map() } as any,
    );

    await service.findAll(7, '  Lobby  ');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'LOWER(room.name) = :roomName',
      {
        roomName: 'lobby',
      },
    );
  });

  it('assertUserCanWrite should block guest until first-message delay expires', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-08T12:00:03.000Z').getTime());
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        isGuest: true,
        createdAt: new Date('2026-05-08T12:00:00.000Z'),
      }),
    };
    const systemSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        guestCanWrite: true,
        guestWaitSeconds: 0,
        firstMessageDelayEnabled: true,
        firstMessageDelaySeconds: 5,
      }),
    };

    const service = new MessagesService(
      {} as any,
      {} as any,
      userRepository as any,
      {} as any,
      {} as any,
      {} as any,
      systemSettingsService as any,
      {} as any,
    );

    await expect((service as any).assertUserCanWrite(7)).rejects.toThrow(
      'İlk mesajınızı 2 saniye sonra gönderebilirsiniz.',
    );
  });

  it('assertUserCanWrite should allow guests immediately when first-message delay is disabled', async () => {
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        isGuest: true,
        createdAt: new Date(),
      }),
    };
    const systemSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        guestCanWrite: true,
        guestWaitSeconds: 0,
        firstMessageDelayEnabled: false,
        firstMessageDelaySeconds: 5,
      }),
    };

    const service = new MessagesService(
      {} as any,
      {} as any,
      userRepository as any,
      {} as any,
      {} as any,
      {} as any,
      systemSettingsService as any,
      {} as any,
    );

    await expect((service as any).assertUserCanWrite(7)).resolves.toBeUndefined();
  });

  it('assertUserCanWrite should block guest until guest wait expires', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-08T12:00:03.000Z').getTime());
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        isGuest: true,
        createdAt: new Date('2026-05-08T12:00:00.000Z'),
      }),
    };
    const systemSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        guestCanWrite: true,
        guestWaitSeconds: 10,
        firstMessageDelayEnabled: false,
        firstMessageDelaySeconds: 0,
      }),
    };

    const service = new MessagesService(
      {} as any,
      {} as any,
      userRepository as any,
      {} as any,
      {} as any,
      {} as any,
      systemSettingsService as any,
      {} as any,
    );

    await expect((service as any).assertUserCanWrite(7)).rejects.toThrow(
      'Misafir bekleme süresi: 7 saniye',
    );
  });

  it('assertUserCanWrite should allow guest after guest wait expires', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-08T12:00:11.000Z').getTime());
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        isGuest: true,
        createdAt: new Date('2026-05-08T12:00:00.000Z'),
      }),
    };
    const systemSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        guestCanWrite: true,
        guestWaitSeconds: 10,
        firstMessageDelayEnabled: false,
        firstMessageDelaySeconds: 0,
      }),
    };

    const service = new MessagesService(
      {} as any,
      {} as any,
      userRepository as any,
      {} as any,
      {} as any,
      {} as any,
      systemSettingsService as any,
      {} as any,
    );

    await expect((service as any).assertUserCanWrite(7)).resolves.toBeUndefined();
  });

  it('assertUserCanWrite should start guest wait from setting update when it is newer than guest creation', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-08T12:00:08.000Z').getTime());
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        isGuest: true,
        createdAt: new Date('2026-05-08T12:00:00.000Z'),
      }),
    };
    const systemSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        guestCanWrite: true,
        guestWaitSeconds: 10,
        guestWaitUpdatedAt: new Date('2026-05-08T12:00:05.000Z'),
        firstMessageDelayEnabled: false,
        firstMessageDelaySeconds: 0,
      }),
    };

    const service = new MessagesService(
      {} as any,
      {} as any,
      userRepository as any,
      {} as any,
      {} as any,
      {} as any,
      systemSettingsService as any,
      {} as any,
    );

    await expect((service as any).assertUserCanWrite(7)).rejects.toThrow(
      'Misafir bekleme süresi: 7 saniye',
    );
  });

  it('assertUserCanWrite should not apply guest-only wait to members', async () => {
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        isGuest: false,
        createdAt: new Date('2026-05-08T12:00:00.000Z'),
      }),
    };
    const systemSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        guestCanWrite: false,
        guestWaitSeconds: 10,
        firstMessageDelayEnabled: false,
        firstMessageDelaySeconds: 0,
      }),
    };

    const service = new MessagesService(
      {} as any,
      {} as any,
      userRepository as any,
      {} as any,
      {} as any,
      {} as any,
      systemSettingsService as any,
      {} as any,
    );

    await expect((service as any).assertUserCanWrite(7)).resolves.toBeUndefined();
  });

  it('assertUserCanWrite should apply first-message delay to members', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-08T12:00:03.000Z').getTime());
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        isGuest: false,
        createdAt: new Date('2026-05-08T12:00:00.000Z'),
      }),
    };
    const systemSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        guestCanWrite: false,
        guestWaitSeconds: 0,
        firstMessageDelayEnabled: true,
        firstMessageDelaySeconds: 5,
      }),
    };

    const service = new MessagesService(
      {} as any,
      {} as any,
      userRepository as any,
      {} as any,
      {} as any,
      {} as any,
      systemSettingsService as any,
      {} as any,
    );

    await expect((service as any).assertUserCanWrite(7)).rejects.toThrow(
      'İlk mesajınızı 2 saniye sonra gönderebilirsiniz.',
    );
  });

  it('assertUserCanWrite should block guest when guest writing is disabled', async () => {
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        isGuest: true,
        createdAt: new Date('2026-05-08T12:00:00.000Z'),
      }),
    };
    const systemSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        guestCanWrite: false,
        guestWaitSeconds: 10,
        firstMessageDelayEnabled: false,
        firstMessageDelaySeconds: 0,
      }),
    };

    const service = new MessagesService(
      {} as any,
      {} as any,
      userRepository as any,
      {} as any,
      {} as any,
      {} as any,
      systemSettingsService as any,
      {} as any,
    );

    await expect((service as any).assertUserCanWrite(7)).rejects.toThrow(
      'Misafirler için mesaj gönderme kapalı.',
    );
  });

  it('clearRoomHistoryForEveryone should soft-delete only the target room and emit clear event', async () => {
    const messageRepository = {
      softDelete: jest.fn().mockResolvedValue({ affected: 3 }),
    };
    const roomRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 12,
        name: 'Lobby',
        voiceId: 'voice_lobby',
      }),
    };
    const roomsGateway = {
      emitRoomHistoryCleared: jest.fn(),
    };

    const service = new MessagesService(
      messageRepository as any,
      roomRepository as any,
      {} as any,
      {} as any,
      {} as any,
      roomsGateway as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.clearRoomHistoryForEveryone('  Lobby  '),
    ).resolves.toEqual({
      deletedMessagesCount: 3,
    });

    expect(roomRepository.findOne).toHaveBeenCalledWith({
      where: { name: 'Lobby' },
    });
    expect(messageRepository.softDelete).toHaveBeenCalledWith({
      roomId: 12,
      deletedAt: expect.anything(),
    });
    expect(roomsGateway.emitRoomHistoryCleared).toHaveBeenCalledWith({
      room: 'voice_lobby',
      roomName: 'Lobby',
    });
  });

  it('findAll should migrate inline history icons to upload paths', async () => {
    const queryBuilder = createQueryBuilderMock();
    queryBuilder.getMany.mockResolvedValue([
      {
        id: 15,
        content: 'Merhaba',
        createdAt: new Date('2026-04-28T18:00:00.000Z'),
        updatedAt: new Date('2026-04-28T18:00:00.000Z'),
        type: 'NORMAL',
        image: null,
        audio: null,
        audioFileName: null,
        fontColor: null,
        targetGroup: null,
        botId: null,
        botAvatar: null,
        botUsername: null,
        botGender: null,
        senderIdentityKey: 'u:3:normal',
        senderIdentityType: 'normal',
        senderPublicName: 'busra',
        userId: 3,
        roomId: 2,
        user: {
          id: 3,
          username: 'busra',
          gender: 'female',
          icon: 'data:image/png;base64,QUJDRA==',
          fontName: null,
          granite: null,
          nickColor: null,
          flashNick: null,
          role: null,
        },
      },
    ]);

    const messageRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const userRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const service = new MessagesService(
      messageRepository as any,
      {} as any,
      userRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { rooms: new Map() } as any,
    );

    jest
      .spyOn(service as any, 'persistDataUrlAsset')
      .mockResolvedValue('/uploads/user-icons/icon.png');

    const messages = await service.findAll(42, undefined, undefined, true);

    expect(userRepository.update).toHaveBeenCalledWith(3, {
      icon: '/uploads/user-icons/icon.png',
    });
    expect(messages[0]?.user.icon).toBe('/uploads/user-icons/icon.png');
  });

  it('toResponse should preserve wall-clock time as UTC for message dates', () => {
    const service = new MessagesService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { rooms: new Map() } as any,
    );

    const response = (service as any).toResponse({
      id: 9,
      content: 'Saat testi',
      type: 'NORMAL',
      userId: 4,
      user: {
        id: 4,
        username: 'kaan',
        gender: 'male',
        isGuest: false,
        icon: null,
        role: null,
      },
      roomId: 2,
      replyToMessageId: null,
      replyToMessage: null,
      image: null,
      audio: null,
      audioFileName: null,
      fontColor: null,
      targetGroup: null,
      botId: null,
      botUsername: null,
      botSpeakerUsername: null,
      botSpeakerDisplayName: null,
      createdAt: new Date(2026, 3, 28, 22, 3, 0, 0),
      updatedAt: new Date(2026, 3, 28, 22, 3, 0, 0),
    });

    expect(response.createdAt).toBe('2026-04-28T22:03:00.000Z');
    expect(response.updatedAt).toBe('2026-04-28T22:03:00.000Z');
  });

  it('toResponse should expose guest state for message users', () => {
    const service = new MessagesService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { rooms: new Map() } as any,
    );

    const baseMessage = {
      id: 10,
      content: 'Misafir testi',
      type: 'NORMAL',
      userId: 5,
      roomId: 2,
      replyToMessageId: null,
      replyToMessage: null,
      image: null,
      audio: null,
      audioFileName: null,
      fontColor: null,
      targetGroup: null,
      botId: null,
      botUsername: null,
      botSpeakerUsername: null,
      botSpeakerDisplayName: null,
      createdAt: new Date('2026-04-28T18:00:00.000Z'),
      updatedAt: new Date('2026-04-28T18:00:00.000Z'),
    };

    const guestResponse = (service as any).toResponse({
      ...baseMessage,
      user: {
        id: 5,
        username: 'misafir',
        gender: 'female',
        isGuest: true,
        icon: null,
        role: null,
      },
    });
    const memberResponse = (service as any).toResponse({
      ...baseMessage,
      user: {
        id: 6,
        username: 'uye',
        gender: 'male',
        isGuest: false,
        icon: null,
        role: null,
      },
    });

    expect(guestResponse.user.isGuest).toBe(true);
    expect(memberResponse.user.isGuest).toBe(false);
  });
});
