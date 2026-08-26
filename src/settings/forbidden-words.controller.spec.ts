jest.mock(
  'src/common/decorators/public.decorator',
  () => ({
    IS_PUBLIC_KEY: 'isPublic',
  }),
  { virtual: true },
);

const { ForbiddenWordsController } = require('./forbidden-words.controller');

describe('ForbiddenWordsController broadcasts updates', () => {
  const createController = () => {
    const forbiddenWordsService = {
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
    const roomsGateway = {
      emitForbiddenWordsUpdated: jest.fn(),
    };

    const controller = new ForbiddenWordsController(
      forbiddenWordsService as any,
      adminActionsService as any,
      userService as any,
      roomsGateway as any,
    );

    return {
      controller,
      forbiddenWordsService,
      adminActionsService,
      userService,
      roomsGateway,
    };
  };

  it('create should broadcast forbidden words update after success', async () => {
    const { controller, forbiddenWordsService, userService, roomsGateway } =
      createController();

    userService.findById.mockResolvedValue({
      id: 11,
      username: 'member',
      permissions: ['Admin Paneli'],
      role: { permissions: { 'Kelime Yasaklama': true } },
    });
    forbiddenWordsService.create.mockResolvedValue({
      id: 20,
      forbiddenWord: 'test',
      replacementWord: '***',
    });

    await expect(
      controller.create(
        { forbiddenWord: 'test', replacementWord: '***' } as any,
        { user: { sub: 11, username: 'member' } } as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 20 }));

    expect(roomsGateway.emitForbiddenWordsUpdated).toHaveBeenCalledWith({
      type: 'created',
      forbiddenWordId: 20,
    });
  });

  it('remove should broadcast forbidden words update after success', async () => {
    const { controller, forbiddenWordsService, userService, roomsGateway } =
      createController();

    userService.findById.mockResolvedValue({
      id: 11,
      username: 'member',
      permissions: ['Admin Paneli'],
      role: { permissions: { 'Kelime Yasaklama': true } },
    });
    forbiddenWordsService.findEntityById.mockResolvedValue({
      id: 5,
      forbiddenWord: 'test',
      replacementWord: '***',
    });
    forbiddenWordsService.remove.mockResolvedValue(undefined);

    await expect(
      controller.remove(5, { user: { sub: 11, username: 'member' } } as any),
    ).resolves.toBeUndefined();

    expect(roomsGateway.emitForbiddenWordsUpdated).toHaveBeenCalledWith({
      type: 'deleted',
      forbiddenWordId: 5,
    });
  });
});
