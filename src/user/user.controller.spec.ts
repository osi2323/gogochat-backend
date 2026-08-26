jest.mock(
  'src/common/decorators/public.decorator',
  () => ({
    IS_PUBLIC_KEY: 'isPublic',
  }),
  { virtual: true },
);

const { UserController } = require('./user.controller');

describe('UserController', () => {
  const buildController = () => {
    const userService = {
      findById: jest.fn().mockResolvedValue({
        id: 1,
        username: 'admin',
        permissions: [
          'Admin Paneli',
          'Yetkili Yönetimi',
          'Üye Yönetimi',
          'Yetki Verebilir',
        ],
        role: { permissions: {} },
      }),
      updateUserByAdmin: jest.fn(),
      deleteUserByAdmin: jest.fn().mockResolvedValue(undefined),
    };
    const adminActionsService = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };
    const roomsGateway = {
      emitUserRoleChanged: jest.fn(),
      updateUserRoleInAllRooms: jest.fn(),
      syncFlashNickInAllRooms: jest.fn(),
    };
    const roleRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 10,
        starCount: 2,
      }),
    };

    const controller = new UserController(
      userService as any,
      adminActionsService as any,
      roomsGateway as any,
      roleRepository as any,
    );

    return {
      controller,
      userService,
      adminActionsService,
      roomsGateway,
      roleRepository,
    };
  };

  const request = {
    user: {
      sub: '1',
      username: 'admin',
    },
    tenant: 'master',
  } as any;

  const updatedUser = {
    id: 2,
    username: 'member',
    roleId: 10,
    role: {
      id: 10,
      name: 'Moderator',
      starCount: 2,
      starColor: '#ffcc00',
      icon: 'shield',
    },
  } as any;

  it('emits user:roleChanged when only permissions are updated', async () => {
    const { controller, userService, roomsGateway } = buildController();
    userService.updateUserByAdmin.mockResolvedValue(updatedUser);

    await controller.updateUserByAdmin(request, 2, {
      permissions: ['Toplantı Yetkisi'],
    } as any);

    expect(roomsGateway.emitUserRoleChanged).toHaveBeenCalledTimes(1);
    expect(roomsGateway.emitUserRoleChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: updatedUser.id,
        username: updatedUser.username,
        roleId: updatedUser.roleId,
      }),
    );
    expect(roomsGateway.updateUserRoleInAllRooms).not.toHaveBeenCalled();
  });

  it('keeps emitting role change and room role sync when roleId changes', async () => {
    const { controller, userService, roomsGateway } = buildController();
    userService.updateUserByAdmin.mockResolvedValue(updatedUser);

    await controller.updateUserByAdmin(request, 2, {
      roleId: 10,
    } as any);

    expect(roomsGateway.emitUserRoleChanged).toHaveBeenCalledTimes(1);
    expect(roomsGateway.updateUserRoleInAllRooms).toHaveBeenCalledTimes(1);
    expect(roomsGateway.updateUserRoleInAllRooms).toHaveBeenCalledWith(
      updatedUser.username,
      expect.objectContaining({
        name: updatedUser.role.name,
        starCount: updatedUser.role.starCount,
      }),
      updatedUser.id,
    );
    expect(roomsGateway.emitUserRoleChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: request.tenant,
      }),
    );
  });

  it('does not emit role change events for unrelated profile updates', async () => {
    const { controller, userService, roomsGateway } = buildController();
    userService.updateUserByAdmin.mockResolvedValue(updatedUser);

    await controller.updateUserByAdmin(request, 2, {
      gender: 'male',
    } as any);

    expect(roomsGateway.emitUserRoleChanged).not.toHaveBeenCalled();
    expect(roomsGateway.updateUserRoleInAllRooms).not.toHaveBeenCalled();
  });

  it('rejects flash nick updates when Flash Nick Yükleme permission is missing', async () => {
    const { controller, userService } = buildController();
    userService.findById.mockResolvedValue({
      id: 1,
      username: 'admin',
      permissions: ['Admin Paneli', 'Yetkili Yönetimi', 'Üye Yönetimi'],
      role: { permissions: {} },
    });

    await expect(
      controller.updateUserByAdmin(request, 2, {
        flashNick: 'data:image/png;base64,AAAA',
      } as any),
    ).rejects.toThrow('Flash nick yükleme yetkiniz yok.');
  });

  it('syncs flash nick in rooms when admin updates flash nick', async () => {
    const { controller, userService, roomsGateway } = buildController();
    userService.findById.mockResolvedValue({
      id: 1,
      username: 'admin',
      permissions: [
        'Admin Paneli',
        'Yetkili Yönetimi',
        'Üye Yönetimi',
        'Flash Nick Yükleme',
      ],
      role: { permissions: {} },
    });
    userService.updateUserByAdmin.mockResolvedValue({
      ...updatedUser,
      flashNick: 'data:image/png;base64,AAAA',
    });

    await controller.updateUserByAdmin(request, 2, {
      flashNick: 'data:image/png;base64,AAAA',
    } as any);

    expect(roomsGateway.syncFlashNickInAllRooms).toHaveBeenCalledWith(
      updatedUser.username,
      'data:image/png;base64,AAAA',
    );
  });

  it('rejects member updates when Üye Yönetimi permission is missing', async () => {
    const { controller, userService } = buildController();
    userService.findById.mockResolvedValue({
      id: 1,
      username: 'admin',
      permissions: ['Admin Paneli', 'Yetkili Yönetimi', 'Yetki Verebilir'],
      role: { permissions: {} },
    });

    await expect(
      controller.updateUserByAdmin(request, 2, {
        gender: 'male',
      } as any),
    ).rejects.toThrow('Üye yönetimi yetkiniz yok.');
  });

  it('strips permissions override when Yetki Verebilir permission is missing', async () => {
    const { controller, userService, roomsGateway } = buildController();
    userService.findById.mockResolvedValue({
      id: 1,
      username: 'admin',
      permissions: ['Admin Paneli', 'Yetkili Yönetimi', 'Üye Yönetimi'],
      role: { permissions: {} },
    });
    userService.updateUserByAdmin.mockResolvedValue(updatedUser);

    const payload = {
      permissions: ['Toplantı Yetkisi'],
      gender: 'male',
    } as any;

    await controller.updateUserByAdmin(request, 2, payload);

    expect(userService.updateUserByAdmin).toHaveBeenCalledWith(
      Number(request.user.sub),
      2,
      expect.objectContaining({
        gender: 'male',
      }),
    );
    expect(payload).not.toHaveProperty('permissions');
    expect(roomsGateway.emitUserRoleChanged).not.toHaveBeenCalled();
  });

  it('rejects delete when Üye ve Yetkili Silme permission is missing', async () => {
    const { controller, userService } = buildController();
    userService.findById.mockImplementation(async (id: number) => {
      if (Number(id) === 1) {
        return {
          id: 1,
          username: 'admin',
          permissions: ['Admin Paneli', 'Üye Yönetimi'],
          role: { permissions: {} },
        };
      }
      return {
        id: 2,
        username: 'member',
        role: { starCount: 0, permissions: {} },
      };
    });

    await expect(controller.deleteUserByAdmin(request, 2)).rejects.toThrow(
      'Üye ve yetkili silme yetkiniz yok.',
    );
  });

  it('allows delete when management and Üye ve Yetkili Silme permissions exist', async () => {
    const { controller, userService } = buildController();
    userService.findById.mockImplementation(async (id: number) => {
      if (Number(id) === 1) {
        return {
          id: 1,
          username: 'admin',
          permissions: ['Admin Paneli', 'Üye Yönetimi', 'Üye ve Yetkili Silme'],
          role: { permissions: {} },
        };
      }
      return {
        id: 2,
        username: 'member',
        role: { starCount: 0, permissions: {} },
      };
    });

    await expect(controller.deleteUserByAdmin(request, 2)).resolves.toBeUndefined();
    expect(userService.deleteUserByAdmin).toHaveBeenCalledWith(1, 2);
  });
});
