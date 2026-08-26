jest.mock(
  'src/common/decorators/public.decorator',
  () => ({
    IS_PUBLIC_KEY: 'isPublic',
  }),
  { virtual: true },
);

const { ForbiddenNicknamesController } = require('./forbidden-nicknames.controller');

describe('ForbiddenNicknamesController permission checks', () => {
  const createController = () => {
    const forbiddenNicknamesService = {
      findAll: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      findEntityById: jest.fn(),
    };
    const adminActionsService = {
      logAction: jest.fn(),
    };
    const userService = {
      findById: jest.fn(),
    };

    const controller = new ForbiddenNicknamesController(
      forbiddenNicknamesService as any,
      adminActionsService as any,
      userService as any,
    );

    return {
      controller,
      forbiddenNicknamesService,
      adminActionsService,
      userService,
    };
  };

  it('create should reject when user lacks Rumuz Yasaklama', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 11,
      username: 'member',
      permissions: ['Admin Paneli'],
      role: { permissions: {} },
    });

    await expect(
      controller.create(
        { nickname: 'testnick' } as any,
        { user: { sub: 11, username: 'member' } } as any,
      ),
    ).rejects.toThrow('Rumuz yasaklama yetkiniz yok.');
  });

  it('remove should reject when user lacks Rumuz Yasaklama', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 11,
      username: 'member',
      permissions: ['Admin Paneli'],
      role: { permissions: {} },
    });

    await expect(
      controller.remove(5, { user: { sub: 11, username: 'member' } } as any),
    ).rejects.toThrow('Rumuz yasaklama yetkiniz yok.');
  });

  it('create should allow when role has Rumuz Yasaklama', async () => {
    const { controller, forbiddenNicknamesService, userService } =
      createController();
    userService.findById.mockResolvedValue({
      id: 11,
      username: 'member',
      permissions: ['Admin Paneli'],
      role: { permissions: { 'Rumuz Yasaklama': true } },
    });
    forbiddenNicknamesService.create.mockResolvedValue({
      id: 20,
      nickname: 'testnick',
    });

    await expect(
      controller.create(
        { nickname: 'testnick' } as any,
        { user: { sub: 11, username: 'member' } } as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 20 }));
    expect(forbiddenNicknamesService.create).toHaveBeenCalledWith(
      { nickname: 'testnick' },
      11,
    );
  });

  it('remove should allow root bypass without user lookup', async () => {
    const { controller, forbiddenNicknamesService, userService } =
      createController();
    forbiddenNicknamesService.findEntityById.mockResolvedValue({
      id: 5,
      nickname: 'testnick',
    });
    forbiddenNicknamesService.remove.mockResolvedValue(undefined);

    await expect(
      controller.remove(5, { user: { sub: 1, username: 'root' } } as any),
    ).resolves.toBeUndefined();
    expect(userService.findById).not.toHaveBeenCalled();
    expect(forbiddenNicknamesService.remove).toHaveBeenCalledWith(5);
  });
});
