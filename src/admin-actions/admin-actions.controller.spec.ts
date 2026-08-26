jest.mock(
  'src/common/decorators/public.decorator',
  () => ({
    IS_PUBLIC_KEY: 'isPublic',
  }),
  { virtual: true },
);

const { AdminActionsController } = require('./admin-actions.controller');

describe('AdminActionsController permission checks', () => {
  const createController = () => {
    const adminActionsService = {
      findAllPaginated: jest.fn(),
    };
    const userService = {
      findById: jest.fn(),
    };

    const controller = new AdminActionsController(
      adminActionsService as any,
      userService as any,
    );

    return { controller, adminActionsService, userService };
  };

  it('findAll should reject when Admin Hareketleri permission is missing', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 9,
      username: 'member',
      permissions: ['Admin Paneli'],
      role: { permissions: {} },
    });

    await expect(
      controller.findAll(1, 20, undefined, {
        user: { sub: 9, username: 'member' },
        fullUser: { role: { starCount: 3 } },
      } as any),
    ).rejects.toThrow('Admin hareketlerini görüntüleme yetkiniz yok.');
  });

  it('findAll should allow when both Admin Paneli and Admin Hareketleri exist', async () => {
    const { controller, adminActionsService, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 9,
      username: 'member',
      permissions: ['Admin Paneli', 'Admin Hareketleri'],
      role: { permissions: {} },
    });
    adminActionsService.findAllPaginated.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      pageCount: 1,
    });

    await expect(
      controller.findAll(1, 20, undefined, {
        user: { sub: 9, username: 'member' },
        fullUser: { role: { starCount: 3 } },
      } as any),
    ).resolves.toEqual(expect.objectContaining({ total: 0 }));
  });

  it('findAll should allow root bypass', async () => {
    const { controller, adminActionsService, userService } = createController();
    adminActionsService.findAllPaginated.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      pageCount: 1,
    });

    await expect(
      controller.findAll(1, 20, undefined, {
        user: { sub: 1, username: 'root' },
        fullUser: { role: { starCount: 100 } },
      } as any),
    ).resolves.toEqual(expect.objectContaining({ total: 0 }));
    expect(userService.findById).not.toHaveBeenCalled();
  });
});
