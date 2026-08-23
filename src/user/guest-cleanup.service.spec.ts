import { GuestCleanupService } from './guest-cleanup.service';

describe('GuestCleanupService', () => {
  it('should run cleanup once within throttle interval', async () => {
    const userService = {
      cleanupExpiredGuests: jest.fn().mockResolvedValue(undefined),
    };

    const service = new GuestCleanupService(userService as any);

    await service.runIfDue();
    await service.runIfDue();

    expect(userService.cleanupExpiredGuests).toHaveBeenCalledTimes(1);
  });

  it('should swallow cleanup errors', async () => {
    const userService = {
      cleanupExpiredGuests: jest.fn().mockRejectedValue(new Error('db error')),
    };

    const service = new GuestCleanupService(userService as any);

    await expect(service.runIfDue()).resolves.toBeUndefined();
  });
});
