import { RoomsService } from './rooms.service';

describe('RoomsService radio update handling', () => {
  const createService = () => {
    const roomRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (room) => room),
    };
    const userService = {
      findByUsername: jest.fn(),
    };
    const tenantContext = {
      getTenant: jest.fn(() => 'master'),
    };

    const service = new RoomsService(
      roomRepository as any,
      userService as any,
      tenantContext as any,
    );

    return { service, roomRepository };
  };

  const createRoom = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    name: 'Lobby',
    voiceId: 'lobby-voice',
    ownerId: null,
    owner: null,
    description: null,
    maxUsers: 200,
    visibleUserCount: 15,
    isPrivate: false,
    isEditable: true,
    password: null,
    radioPanelLink: 'https://room-radio.test/stream',
    radioRequestLink: 'https://room-radio.test/request',
    listOrder: 1,
    minStar: 0,
    backgroundColor: null,
    roomImage: null,
    logo: null,
    createdAt: new Date('2026-05-15T00:00:00.000Z'),
    updatedAt: new Date('2026-05-15T00:00:00.000Z'),
    ...overrides,
  });

  it('clears a room radio panel link when an empty value is submitted', async () => {
    const { service, roomRepository } = createService();
    const room = createRoom();
    roomRepository.findOne.mockResolvedValue(room);

    const response = await service.update(1, { radioPanelLink: '' } as any);

    expect(roomRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ radioPanelLink: null }),
    );
    expect(response.radioPanelLink).toBeNull();
  });

  it('keeps existing room radio links when radio fields are omitted', async () => {
    const { service, roomRepository } = createService();
    const room = createRoom();
    roomRepository.findOne.mockResolvedValue(room);

    const response = await service.update(1, { name: 'Lobby Updated' } as any);

    expect(roomRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        radioPanelLink: 'https://room-radio.test/stream',
        radioRequestLink: 'https://room-radio.test/request',
      }),
    );
    expect(response.radioPanelLink).toBe('https://room-radio.test/stream');
    expect(response.radioRequestLink).toBe('https://room-radio.test/request');
  });
});
