jest.mock(
  'src/common/decorators/public.decorator',
  () => ({
    IS_PUBLIC_KEY: 'isPublic',
    Public: () => () => undefined,
  }),
  { virtual: true },
);

const { ForbiddenException } = require('@nestjs/common');
const { SystemSettingsController } = require('./system-settings.controller');
const { AdminActionType } = require('../admin-actions/enums/admin-action-type.enum');

describe('SystemSettingsController root operation permissions', () => {
  const createController = (user: any) => {
    const systemSettingsService = {
      repairRoot: jest.fn().mockResolvedValue({ message: 'Root hesabı onarıldı.' }),
      changeRootPassword: jest
        .fn()
        .mockResolvedValue({ message: 'Root şifresi değiştirildi.' }),
      startSystemReset: jest.fn().mockReturnValue({
        message: 'Sistem resetleme başlatıldı.',
        countdownSeconds: 10,
        remainingDurationMs: 30000,
        timestamp: '2026-05-05T12:00:00.000Z',
        deletedMessagesCount: 7,
      }),
      getSystemResetStatus: jest.fn().mockReturnValue({
        active: true,
        countdownSeconds: 9,
        remainingDurationMs: 27000,
        message: 'Sistem resetleniyor',
        timestamp: '2026-05-05T12:00:00.000Z',
      }),
    };
    const userService = {
      findById: jest.fn().mockResolvedValue(user),
    };
    const adminActionsService = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };

    return {
      controller: new SystemSettingsController(
        systemSettingsService as any,
        userService as any,
        adminActionsService as any,
      ),
      systemSettingsService,
      userService,
      adminActionsService,
    };
  };

  it('changeRootPassword should allow 25 rank user without admin permissions', async () => {
    const { controller, systemSettingsService } = createController({
      permissions: [],
      role: { starCount: 25, permissions: {} },
    });

    await expect(
      controller.changeRootPassword(
        { user: { sub: 7, username: 'admin25' } } as any,
        { password: 'new-pass' },
      ),
    ).resolves.toEqual({ message: 'Root şifresi değiştirildi.' });
    expect(systemSettingsService.changeRootPassword).toHaveBeenCalledWith(
      'new-pass',
      'admin25',
    );
  });

  it('repairRoot should reject admin below 25 rank', async () => {
    const { controller, systemSettingsService } = createController({
      permissions: ['Admin Paneli', 'Site Ayarları'],
      role: { starCount: 24, permissions: {} },
    });

    await expect(
      controller.repairRoot({ user: { sub: 8, username: 'admin24' } } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(systemSettingsService.repairRoot).not.toHaveBeenCalled();
  });

  it('startSystemReset should reject without site settings permission', async () => {
    const { controller, systemSettingsService, adminActionsService } =
      createController({
      permissions: ['Admin Paneli'],
      role: { starCount: 5, permissions: {} },
    });

    await expect(
      controller.startSystemReset({
        user: { sub: 9, username: 'limitedAdmin' },
      } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(systemSettingsService.startSystemReset).not.toHaveBeenCalled();
    expect(adminActionsService.logAction).not.toHaveBeenCalled();
  });

  it('startSystemReset should emit for authorized admin', async () => {
    const { controller, systemSettingsService, adminActionsService } =
      createController({
      permissions: ['Admin Paneli', 'Site Ayarları'],
      role: { starCount: 5, permissions: {} },
    });

    await expect(
      controller.startSystemReset({
        user: { sub: 10, username: 'siteAdmin' },
      } as any),
    ).resolves.toEqual({
      message: 'Sistem resetleme başlatıldı.',
      countdownSeconds: 10,
      remainingDurationMs: 30000,
      timestamp: '2026-05-05T12:00:00.000Z',
      deletedMessagesCount: 7,
    });
    expect(systemSettingsService.startSystemReset).toHaveBeenCalledTimes(1);
    expect(adminActionsService.logAction).toHaveBeenCalledWith({
      adminId: 10,
      adminUsername: 'siteAdmin',
      actionType: AdminActionType.SYSTEM_RESET,
      description: 'Sistem resetleme başlatıldı',
      metadata: {
        countdownSeconds: 10,
        deletedMessagesCount: 7,
      },
    });
  });

  it('getSystemResetStatus should return active reset status', () => {
    const { controller, systemSettingsService } = createController({
      permissions: ['Admin Paneli', 'Site Ayarları'],
      role: { starCount: 5, permissions: {} },
    });

    expect(controller.getSystemResetStatus()).toEqual({
      active: true,
      countdownSeconds: 9,
      remainingDurationMs: 27000,
      message: 'Sistem resetleniyor',
      timestamp: '2026-05-05T12:00:00.000Z',
    });
    expect(systemSettingsService.getSystemResetStatus).toHaveBeenCalledTimes(1);
  });
});
