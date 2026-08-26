jest.mock(
  'src/common/decorators/public.decorator',
  () => ({
    IS_PUBLIC_KEY: 'isPublic',
  }),
  { virtual: true },
);

const { RoleController } = require('./role.controller');

describe('RoleController permission checks', () => {
  const createController = () => {
    const roleService = {
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const userService = {
      findById: jest.fn(),
    };
    const roomsGateway = {
      updateRoleInAllUsers: jest.fn(),
    };

    const controller = new RoleController(
      roleService as any,
      userService as any,
      roomsGateway as any,
    );

    return { controller, roleService, userService, roomsGateway };
  };

  it('update should reject when user does not have Rütbe Yönetimi', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: ['Admin Paneli'],
      role: { permissions: {} },
    });

    await expect(
      controller.update(
        { user: { sub: 10, username: 'member' } } as any,
        3,
        { name: 'Moderator' } as any,
      ),
    ).rejects.toThrow('Rütbe yönetimi yetkiniz yok.');
  });

  it('delete should allow when user has Rütbe Yönetimi', async () => {
    const { controller, roleService, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: ['Admin Paneli', 'Rütbe Yönetimi'],
      role: { permissions: {} },
    });
    roleService.remove.mockResolvedValue(undefined);

    await expect(
      controller.remove({ user: { sub: 10, username: 'member' } } as any, 3),
    ).resolves.toBeUndefined();
    expect(roleService.remove).toHaveBeenCalledWith(3);
  });

  it('create should reject when Admin Paneli permission is missing', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: ['Rütbe Yönetimi'],
      role: { permissions: {} },
    });

    await expect(
      controller.create(
        { user: { sub: 10, username: 'member' } } as any,
        { name: 'New Role' } as any,
      ),
    ).rejects.toThrow('Admin paneli erişim yetkiniz yok.');
  });

  it('create should allow root bypass without permission lookup', async () => {
    const { controller, roleService, userService } = createController();
    roleService.create.mockResolvedValue({ id: 1, name: 'New Role' });

    await expect(
      controller.create(
        { user: { sub: 1, username: 'root' } } as any,
        { name: 'New Role' } as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 1 }));
    expect(userService.findById).not.toHaveBeenCalled();
    expect(roleService.create).toHaveBeenCalled();
  });
});
