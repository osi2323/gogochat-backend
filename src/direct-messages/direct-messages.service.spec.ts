import { DirectMessagesService } from './direct-messages.service';

describe('DirectMessagesService', () => {
  const createBase = () => {
    const conversationRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 12,
        user1Id: 10,
        user1IdentityKey: 'u:10:normal',
        user1IdentityType: 'normal',
        user2Id: 20,
        user2IdentityKey: 'u:20:normal',
        user2IdentityType: 'normal',
        user1DisplayName: null,
        user2DisplayName: null,
        user1: {
          id: 10,
          username: 'senderUser',
          isGuest: false,
          icon: '1',
          gender: 'male',
          chatPreferences: {},
        },
        user2: {
          id: 20,
          username: 'targetUser',
          isGuest: false,
          icon: '2',
          gender: 'female',
          chatPreferences: {},
        },
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const messageRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      }),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({ id: 77 }),
      findOne: jest.fn().mockResolvedValue({
        id: 77,
        content: 'merhaba',
        image: null,
        audio: null,
        audioFileName: null,
        senderId: 10,
        createdAt: new Date(),
        senderIdentityType: 'normal',
        senderDisplayName: null,
        sender: {
          id: 10,
          username: 'senderUser',
          gender: 'male',
          icon: '1',
        },
      }),
    };

    const userRepository = {
      findOne: jest.fn(),
    };

    const dmGateway = {
      emitNewMessage: jest.fn().mockResolvedValue(undefined),
      emitBuzz: jest.fn().mockResolvedValue(undefined),
      isUserOnline: jest.fn().mockResolvedValue(true),
    };

    const friendsService = {
      ensureNotBlockedBetweenUsers: jest.fn().mockResolvedValue(undefined),
    };

    return {
      conversationRepository,
      messageRepository,
      userRepository,
      dmGateway,
      friendsService,
    };
  };

  it('sendMessage should reject when member PM is disabled and the peer is guest', async () => {
    const deps = createBase();
    const conversation = await deps.conversationRepository.findOne();
    deps.conversationRepository.findOne.mockResolvedValue({
      ...conversation,
      user2: {
        ...conversation.user2,
        isGuest: true,
      },
    });
    deps.userRepository.findOne.mockResolvedValue({
      id: 10,
      username: 'senderUser',
      isGuest: false,
      permissions: [],
      role: { permissions: { Banlama: true } },
    });

    const service = new DirectMessagesService(
      deps.conversationRepository as any,
      deps.messageRepository as any,
      deps.userRepository as any,
      deps.dmGateway as any,
      deps.friendsService as any,
      {
        getCommunicationPermissions: jest.fn().mockResolvedValue({
          guestPrivateMessageEnabled: true,
          membersPrivateMessageEnabled: false,
        }),
      } as any,
      { rooms: new Map() } as any,
    );

    await expect(
      service.sendMessage(undefined, 10, undefined, 12, { content: 'selam' }),
    ).rejects.toThrow('Üyelere özel mesaj kapalı.');
  });

  it('sendMessage should reject when PM permission exists but global PM setting is disabled', async () => {
    const deps = createBase();
    const conversation = await deps.conversationRepository.findOne();
    deps.conversationRepository.findOne.mockResolvedValue({
      ...conversation,
      user2: {
        ...conversation.user2,
        isGuest: true,
      },
    });
    deps.userRepository.findOne.mockResolvedValue({
      id: 10,
      username: 'senderUser',
      isGuest: false,
      permissions: ['Özel Mesaj Atma'],
      role: { permissions: {} },
    });

    const service = new DirectMessagesService(
      deps.conversationRepository as any,
      deps.messageRepository as any,
      deps.userRepository as any,
      deps.dmGateway as any,
      deps.friendsService as any,
      {
        getCommunicationPermissions: jest.fn().mockResolvedValue({
          guestPrivateMessageEnabled: true,
          membersPrivateMessageEnabled: false,
        }),
      } as any,
      { rooms: new Map() } as any,
    );

    await expect(
      service.sendMessage(undefined, 10, undefined, 12, { content: 'selam' }),
    ).rejects.toThrow('Üyelere özel mesaj kapalı.');
  });

  it('sendMessage should allow when global PM setting is enabled', async () => {
    const deps = createBase();
    deps.userRepository.findOne.mockResolvedValue({
      id: 10,
      username: 'senderUser',
      isGuest: false,
      permissions: [],
      role: { permissions: { 'Özel Mesaj Atma': true } },
    });

    const service = new DirectMessagesService(
      deps.conversationRepository as any,
      deps.messageRepository as any,
      deps.userRepository as any,
      deps.dmGateway as any,
      deps.friendsService as any,
      {
        getCommunicationPermissions: jest.fn().mockResolvedValue({
          guestPrivateMessageEnabled: true,
          membersPrivateMessageEnabled: true,
        }),
      } as any,
      { rooms: new Map() } as any,
    );

    const result = await service.sendMessage(undefined, 10, undefined, 12, {
      content: 'merhaba',
    });

    expect(result).toEqual(expect.objectContaining({ id: 77, senderId: 10 }));
    expect(deps.friendsService.ensureNotBlockedBetweenUsers).toHaveBeenCalledWith(
      10,
      20,
    );
    expect(deps.dmGateway.emitNewMessage).toHaveBeenCalledTimes(1);
  });

  it('sendMessage should revive the recipient view for the first message after cleared history', async () => {
    const deps = createBase();
    const clearedAt = new Date('2026-05-15T10:00:00.001Z');
    const savedMessageCreatedAt = new Date('2026-05-15T10:00:00.000Z');
    const conversation = await deps.conversationRepository.findOne();
    conversation.deletedAtUser2 = clearedAt;
    conversation.clearedAtUser2 = clearedAt;
    conversation.lastReadAtUser2 = clearedAt;
    deps.conversationRepository.findOne.mockResolvedValue(conversation);
    deps.messageRepository.findOne.mockResolvedValue({
      id: 77,
      content: 'ilk yeni mesaj',
      image: null,
      audio: null,
      audioFileName: null,
      senderId: 10,
      createdAt: savedMessageCreatedAt,
      senderIdentityType: 'normal',
      senderDisplayName: null,
      sender: {
        id: 10,
        username: 'senderUser',
        gender: 'male',
        icon: '1',
        role: { starCount: 0 },
      },
    });
    deps.userRepository.findOne.mockResolvedValue({
      id: 10,
      username: 'senderUser',
      isGuest: false,
      role: { permissions: {}, starCount: 0 },
    });

    const service = new DirectMessagesService(
      deps.conversationRepository as any,
      deps.messageRepository as any,
      deps.userRepository as any,
      deps.dmGateway as any,
      deps.friendsService as any,
      {
        getCommunicationPermissions: jest.fn().mockResolvedValue({
          guestPrivateMessageEnabled: true,
          membersPrivateMessageEnabled: true,
        }),
      } as any,
      { rooms: new Map() } as any,
    );

    await service.sendMessage(undefined, 10, undefined, 12, {
      content: 'ilk yeni mesaj',
    });

    const expectedVisibleFrom = new Date('2026-05-15T09:59:59.999Z');
    expect(conversation.deletedAtUser2).toBeNull();
    expect(conversation.clearedAtUser2).toEqual(expectedVisibleFrom);
    expect(conversation.lastReadAtUser2).toEqual(expectedVisibleFrom);
    expect(deps.conversationRepository.save).toHaveBeenCalledWith(conversation);
  });

  it('sendMessage should include reply summary when replying to a message in the same conversation', async () => {
    const deps = createBase();
    const replyMessage = {
      id: 42,
      conversationId: 12,
      content: 'onceki mesaj',
      image: null,
      audio: null,
      senderId: 20,
      senderIdentityType: 'normal',
      senderDisplayName: 'Target User',
      createdAt: new Date('2026-05-12T09:00:00.000Z'),
      sender: {
        id: 20,
        username: 'targetUser',
      },
    };
    const savedMessage = {
      id: 77,
      content: 'cevap',
      image: null,
      audio: null,
      audioFileName: null,
      senderId: 10,
      createdAt: new Date('2026-05-12T09:01:00.000Z'),
      senderIdentityType: 'normal',
      senderDisplayName: null,
      replyToMessage: replyMessage,
      sender: {
        id: 10,
        username: 'senderUser',
        gender: 'male',
        icon: '1',
        role: { starCount: 0 },
      },
    };
    deps.messageRepository.findOne
      .mockResolvedValueOnce(replyMessage)
      .mockResolvedValueOnce(savedMessage);
    deps.userRepository.findOne.mockResolvedValue({
      id: 10,
      username: 'senderUser',
      isGuest: false,
      role: { permissions: {}, starCount: 0 },
    });

    const service = new DirectMessagesService(
      deps.conversationRepository as any,
      deps.messageRepository as any,
      deps.userRepository as any,
      deps.dmGateway as any,
      deps.friendsService as any,
      {
        getCommunicationPermissions: jest.fn().mockResolvedValue({
          guestPrivateMessageEnabled: true,
          membersPrivateMessageEnabled: true,
        }),
      } as any,
      { rooms: new Map() } as any,
    );

    const result = await service.sendMessage(undefined, 10, undefined, 12, {
      content: 'cevap',
      replyToMessageId: 42,
    });

    expect(deps.messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ replyToMessageId: 42 }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 77,
        replyToMessage: expect.objectContaining({
          id: 42,
          content: 'onceki mesaj',
          sender: expect.objectContaining({
            displayUsername: 'Target User',
          }),
        }),
      }),
    );
    expect(deps.dmGateway.emitNewMessage).toHaveBeenCalledWith(
      undefined,
      'targetUser',
      expect.objectContaining({
        message: expect.objectContaining({
          replyToMessage: expect.objectContaining({ id: 42 }),
        }),
      }),
      null,
    );
  });

  it('sendMessage should reject replyToMessageId outside the conversation', async () => {
    const deps = createBase();
    deps.messageRepository.findOne.mockResolvedValueOnce({
      id: 42,
      conversationId: 999,
      content: 'baska konusma',
    });

    const service = new DirectMessagesService(
      deps.conversationRepository as any,
      deps.messageRepository as any,
      deps.userRepository as any,
      deps.dmGateway as any,
      deps.friendsService as any,
      {
        getCommunicationPermissions: jest.fn().mockResolvedValue({
          guestPrivateMessageEnabled: true,
          membersPrivateMessageEnabled: true,
        }),
      } as any,
      { rooms: new Map() } as any,
    );

    await expect(
      service.sendMessage(undefined, 10, undefined, 12, {
        content: 'cevap',
        replyToMessageId: 42,
      }),
    ).rejects.toThrow('Yanıtlanan mesaj bulunamadı.');
    expect(deps.messageRepository.save).not.toHaveBeenCalled();
    expect(deps.dmGateway.emitNewMessage).not.toHaveBeenCalled();
  });

  it('sendMessage should allow replying to a member even when sender PM is disabled', async () => {
    const deps = createBase();
    deps.conversationRepository.findOne.mockResolvedValue({
      id: 12,
      user1Id: 10,
      user1IdentityKey: 'u:10:normal',
      user1IdentityType: 'normal',
      user2Id: 20,
      user2IdentityKey: 'u:20:normal',
      user2IdentityType: 'normal',
      user1DisplayName: null,
      user2DisplayName: null,
      user1: {
        id: 10,
        username: 'senderUser',
        isGuest: false,
        icon: '1',
        gender: 'male',
        chatPreferences: {},
        role: { starCount: 0 },
      },
      user2: {
        id: 20,
        username: 'targetMember',
        isGuest: false,
        icon: '2',
        gender: 'female',
        chatPreferences: {},
        role: { starCount: 0 },
      },
    });
    deps.userRepository.findOne.mockResolvedValue({
      id: 10,
      username: 'senderUser',
      isGuest: false,
      permissions: [],
      role: { permissions: {}, starCount: 0 },
    });

    const service = new DirectMessagesService(
      deps.conversationRepository as any,
      deps.messageRepository as any,
      deps.userRepository as any,
      deps.dmGateway as any,
      deps.friendsService as any,
      {
        getCommunicationPermissions: jest.fn().mockResolvedValue({
          guestPrivateMessageEnabled: true,
          membersPrivateMessageEnabled: false,
        }),
      } as any,
      { rooms: new Map() } as any,
    );

    await expect(
      service.sendMessage(undefined, 10, undefined, 12, { content: 'selam' }),
    ).resolves.toEqual(expect.objectContaining({ id: 77, senderId: 10 }));
  });

  it('clearConversation should hide existing messages for the current identity', async () => {
    const deps = createBase();
    const conversation = await deps.conversationRepository.findOne();
    deps.conversationRepository.findOne.mockResolvedValue(conversation);

    const service = new DirectMessagesService(
      deps.conversationRepository as any,
      deps.messageRepository as any,
      deps.userRepository as any,
      deps.dmGateway as any,
      deps.friendsService as any,
      {} as any,
      { rooms: new Map() } as any,
    );

    await expect(
      service.clearConversation(10, undefined, 12),
    ).resolves.toEqual({ status: 'ok' });

    expect(conversation.clearedAtUser1).toBeInstanceOf(Date);
    expect(conversation.lastReadAtUser1).toBe(conversation.clearedAtUser1);
    expect(conversation.clearedAtUser2).toBeUndefined();
    expect(deps.conversationRepository.save).toHaveBeenCalledWith(conversation);
  });

  it('deleteConversation should remove the conversation from the current identity list without clearing the peer', async () => {
    const deps = createBase();
    const conversation = await deps.conversationRepository.findOne();
    deps.conversationRepository.findOne.mockResolvedValue(conversation);

    const service = new DirectMessagesService(
      deps.conversationRepository as any,
      deps.messageRepository as any,
      deps.userRepository as any,
      deps.dmGateway as any,
      deps.friendsService as any,
      {} as any,
      { rooms: new Map() } as any,
    );

    await expect(
      service.deleteConversation(10, undefined, 12),
    ).resolves.toEqual({ status: 'ok' });

    expect(conversation.deletedAtUser1).toBeInstanceOf(Date);
    expect(conversation.clearedAtUser1).toBe(conversation.deletedAtUser1);
    expect(conversation.lastReadAtUser1).toBe(conversation.deletedAtUser1);
    expect(conversation.deletedAtUser2).toBeUndefined();
    expect(deps.conversationRepository.save).toHaveBeenCalledWith(conversation);
  });

  it('buzzConversation should emit buzz to the conversation peer', async () => {
    const deps = createBase();
    const conversation = await deps.conversationRepository.findOne();
    deps.conversationRepository.findOne.mockResolvedValue(conversation);

    const service = new DirectMessagesService(
      deps.conversationRepository as any,
      deps.messageRepository as any,
      deps.userRepository as any,
      deps.dmGateway as any,
      deps.friendsService as any,
      {} as any,
      { rooms: new Map() } as any,
    );

    await expect(
      service.buzzConversation('tenant_master', 10, undefined, 12),
    ).resolves.toEqual({ status: 'ok' });

    expect(deps.friendsService.ensureNotBlockedBetweenUsers).toHaveBeenCalledWith(
      10,
      20,
    );
    expect(deps.dmGateway.emitBuzz).toHaveBeenCalledWith(
      'tenant_master',
      'targetUser',
      expect.objectContaining({
        conversationId: 12,
        fromUsername: 'senderUser',
        fromDisplayUsername: 'senderUser',
      }),
      null,
    );
  });

  it('buzzConversation should reject users outside the conversation', async () => {
    const deps = createBase();

    const service = new DirectMessagesService(
      deps.conversationRepository as any,
      deps.messageRepository as any,
      deps.userRepository as any,
      deps.dmGateway as any,
      deps.friendsService as any,
      {} as any,
      { rooms: new Map() } as any,
    );

    await expect(
      service.buzzConversation('tenant_master', 99, undefined, 12),
    ).rejects.toThrow();
    expect(deps.dmGateway.emitBuzz).not.toHaveBeenCalled();
  });
});
