jest.mock(
  'src/common/decorators/public.decorator',
  () => ({
    IS_PUBLIC_KEY: 'isPublic',
  }),
  { virtual: true },
);

const { LoginHistoryController } = require('./login-history.controller');

describe('LoginHistoryController permission checks', () => {
  const createController = () => {
    const loginHistoryService = {
      findAllPaginated: jest.fn(),
      getLocationByRecordId: jest.fn(),
      getIdentitiesByRecordId: jest.fn(),
    };
    const userService = {
      findById: jest.fn(),
    };

    const controller = new LoginHistoryController(
      loginHistoryService as any,
      userService as any,
    );

    return { controller, loginHistoryService, userService };
  };

  it('getAllLoginHistory should reject when Giriş Kayıtları permission is missing', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: ['Admin Paneli'],
      role: { permissions: {} },
    });

    await expect(
      controller.getAllLoginHistory(1, 20, {
        user: { sub: 10, username: 'member' },
        fullUser: { role: { starCount: 5 } },
      } as any),
    ).rejects.toThrow('Giriş kayıtları görüntüleme yetkiniz yok.');
  });

  it('getAllLoginHistory should allow when Admin Paneli and Giriş Kayıtları exist', async () => {
    const { controller, loginHistoryService, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: ['Admin Paneli', 'Giriş Kayıtları', 'İp Görme Yetkisi'],
      role: { permissions: {} },
    });
    loginHistoryService.findAllPaginated.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      pageCount: 1,
    });

    await expect(
      controller.getAllLoginHistory(1, 20, {
        user: { sub: 10, username: 'member' },
        fullUser: { role: { starCount: 5 } },
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        total: 0,
      }),
    );
    expect(loginHistoryService.findAllPaginated).toHaveBeenCalledWith(
      1,
      20,
      5,
      true,
    );
  });

  it('getLoginLocation should allow root bypass without user lookup', async () => {
    const { controller, loginHistoryService, userService } = createController();
    loginHistoryService.getLocationByRecordId.mockResolvedValue({
      loginHistoryId: 1,
      displayName: 'x',
      ipAddress: '1.1.1.1',
      city: 'x',
      district: 'x',
      country: 'x',
      countryCode: 'x',
      isp: 'x',
    });

    await expect(
      controller.getLoginLocation(1, {
        user: { sub: 1, username: 'root' },
      } as any),
    ).resolves.toEqual(expect.objectContaining({ loginHistoryId: 1 }));
    expect(userService.findById).not.toHaveBeenCalled();
  });

  it('getLoginLocation should reject when İp Görme Yetkisi is missing', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: ['Admin Paneli', 'Giriş Kayıtları'],
      role: { permissions: {} },
    });

    await expect(
      controller.getLoginLocation(1, {
        user: { sub: 10, username: 'member' },
      } as any),
    ).rejects.toThrow('İp görme yetkiniz yok.');
  });

  it('getLoginIdentities should reject when İp Görme Yetkisi is missing', async () => {
    const { controller, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: ['Admin Paneli', 'Giriş Kayıtları'],
      role: { permissions: {} },
    });

    await expect(
      controller.getLoginIdentities(1, {
        user: { sub: 10, username: 'member' },
      } as any),
    ).rejects.toThrow('İp görme yetkiniz yok.');
  });

  it('getAllLoginHistory should request masked IP list when İp Görme Yetkisi is missing', async () => {
    const { controller, loginHistoryService, userService } = createController();
    userService.findById.mockResolvedValue({
      id: 10,
      username: 'member',
      permissions: ['Admin Paneli', 'Giriş Kayıtları'],
      role: { permissions: {} },
    });
    loginHistoryService.findAllPaginated.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      pageCount: 1,
    });

    await expect(
      controller.getAllLoginHistory(1, 20, {
        user: { sub: 10, username: 'member' },
        fullUser: { role: { starCount: 5 } },
      } as any),
    ).resolves.toEqual(expect.objectContaining({ total: 0 }));

    expect(loginHistoryService.findAllPaginated).toHaveBeenCalledWith(
      1,
      20,
      5,
      false,
    );
  });
});
