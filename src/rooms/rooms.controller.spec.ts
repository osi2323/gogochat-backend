jest.mock(
  'src/common/decorators/public.decorator',
  () => ({
    IS_PUBLIC_KEY: 'isPublic',
  }),
  { virtual: true },
);

const { RoomsController } = require('./rooms.controller');

describe('RoomsController permission checks', () => {
  const createController = () => {
    const roomsService = {
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const userService = {
      findById: jest.fn(),
    };

    const controller = new RoomsController(
      roomsService as any,
      userService as any,
    );

    return { controller, roomsService, userService };
  };

  it('create should reject when user does not have Oda Yönetimi', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: ['Admin Paneli'],
      role: { permissions: {} },
    });

    await expect(
      controller.create(
        { user: { sub: 12, username: 'member' } } as any,
        { name: 'Yeni Oda', listOrder: 1 } as any,
        undefined as any,
      ),
    ).rejects.toThrow('Oda yönetimi yetkiniz yok.');
  });

  it('create should reject when Admin Paneli permission is missing', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: ['Oda Yönetimi'],
      role: { permissions: {} },
    });

    await expect(
      controller.create(
        { user: { sub: 12, username: 'member' } } as any,
        { name: 'Yeni Oda', listOrder: 1 } as any,
        undefined as any,
      ),
    ).rejects.toThrow('Admin paneli erişim yetkiniz yok.');
  });

  it('update should allow when role permissions include Oda Yönetimi', async () => {
    const { controller, roomsService, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: [],
      role: { permissions: { 'Admin Paneli': true, 'Oda Yönetimi': true } },
    });
    roomsService.update.mockResolvedValue({ id: 2, name: 'Lobby' });

    await expect(
      controller.update(
        { user: { sub: 12, username: 'member' } } as any,
        2,
        { name: 'Lobby' } as any,
        undefined as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 2 }));
    expect(roomsService.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ name: 'Lobby' }),
      undefined,
    );
  });

  it('create should reject when room encryption change is requested without Oda Şifreleme', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: ['Admin Paneli', 'Oda Yönetimi'],
      role: { permissions: {} },
    });

    await expect(
      controller.create(
        { user: { sub: 12, username: 'member' } } as any,
        { name: 'Yeni Oda', listOrder: 1, isPrivate: true } as any,
        undefined as any,
      ),
    ).rejects.toThrow('Oda şifreleme yetkiniz yok.');
  });

  it('update should allow private/password update when Oda Şifreleme exists', async () => {
    const { controller, roomsService, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: ['Admin Paneli', 'Oda Yönetimi', 'Oda Şifreleme'],
      role: { permissions: {} },
    });
    roomsService.update.mockResolvedValue({ id: 2, name: 'Lobby' });

    await expect(
      controller.update(
        { user: { sub: 12, username: 'member' } } as any,
        2,
        { isPrivate: true, password: '1234' } as any,
        undefined as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 2 }));
    expect(roomsService.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ isPrivate: true, password: '1234' }),
      undefined,
    );
  });

  it('create should reject when radio fields are set without Radyo Yönetimi', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: ['Admin Paneli', 'Oda Yönetimi'],
      role: { permissions: {} },
    });

    await expect(
      controller.create(
        { user: { sub: 12, username: 'member' } } as any,
        {
          name: 'Yeni Oda',
          listOrder: 1,
          radioPanelLink: 'https://radio-panel.test',
        } as any,
        undefined as any,
      ),
    ).rejects.toThrow('Radyo yönetimi yetkiniz yok.');
  });

  it('update should reject when radio fields are updated without Radyo Yönetimi', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: ['Admin Paneli', 'Oda Yönetimi'],
      role: { permissions: {} },
    });

    await expect(
      controller.update(
        { user: { sub: 12, username: 'member' } } as any,
        2,
        { radioRequestLink: '' } as any,
        undefined as any,
      ),
    ).rejects.toThrow('Radyo yönetimi yetkiniz yok.');
  });

  it('create should allow when radio fields are set with Radyo Yönetimi', async () => {
    const { controller, roomsService, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: ['Admin Paneli', 'Oda Yönetimi', 'Radyo Yönetimi'],
      role: { permissions: {} },
    });
    roomsService.create.mockResolvedValue({ id: 3, name: 'Yeni Oda' });

    await expect(
      controller.create(
        { user: { sub: 12, username: 'member' } } as any,
        {
          name: 'Yeni Oda',
          listOrder: 1,
          radioPanelLink: 'https://radio-panel.test',
        } as any,
        undefined as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 3 }));
  });

  it('update should allow when radio fields are updated with Radyo Yönetimi', async () => {
    const { controller, roomsService, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: ['Admin Paneli', 'Oda Yönetimi', 'Radyo Yönetimi'],
      role: { permissions: {} },
    });
    roomsService.update.mockResolvedValue({ id: 2, name: 'Lobby' });

    await expect(
      controller.update(
        { user: { sub: 12, username: 'member' } } as any,
        2,
        { radioRequestLink: '' } as any,
        undefined as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 2 }));
  });

  it('update should reject password change without Oda Şifreleme even when password is empty', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: ['Admin Paneli', 'Oda Yönetimi'],
      role: { permissions: {} },
    });

    await expect(
      controller.update(
        { user: { sub: 12, username: 'member' } } as any,
        2,
        { password: '' } as any,
        undefined as any,
      ),
    ).rejects.toThrow('Oda şifreleme yetkiniz yok.');
  });

  it('remove should reject when Oda Silme permission is missing', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: ['Admin Paneli', 'Oda Yönetimi'],
      role: { permissions: {} },
    });

    await expect(
      controller.remove({ user: { sub: 12, username: 'member' } } as any, 4),
    ).rejects.toThrow('Oda silme yetkiniz yok.');
  });

  it('remove should allow when Oda Yönetimi and Oda Silme permissions exist', async () => {
    const { controller, roomsService, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 12,
      username: 'member',
      permissions: ['Admin Paneli', 'Oda Yönetimi', 'Oda Silme'],
      role: { permissions: {} },
    });
    roomsService.remove.mockResolvedValue(undefined);

    await expect(
      controller.remove({ user: { sub: 12, username: 'member' } } as any, 4),
    ).resolves.toBeUndefined();
    expect(roomsService.remove).toHaveBeenCalledWith(4);
  });

  it('remove should allow root bypass without permission lookup', async () => {
    const { controller, roomsService, userService } = createController();
    roomsService.remove.mockResolvedValue(undefined);

    await expect(
      controller.remove({ user: { sub: 1, username: 'root' } } as any, 4),
    ).resolves.toBeUndefined();
    expect(userService.findById).not.toHaveBeenCalled();
    expect(roomsService.remove).toHaveBeenCalledWith(4);
  });
});
