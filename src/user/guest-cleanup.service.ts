import { Injectable, Logger } from '@nestjs/common';
import { UserService } from './user.service';

@Injectable()
export class GuestCleanupService {
  private readonly logger = new Logger(GuestCleanupService.name);
  private readonly intervalMs = 5 * 60 * 1000;
  private lastRunAt = 0;
  private isRunning = false;

  constructor(private readonly userService: UserService) {}

  async runIfDue(): Promise<void> {
    const now = Date.now();

    if (this.isRunning) {
      return;
    }

    if (now - this.lastRunAt < this.intervalMs) {
      return;
    }

    this.isRunning = true;
    this.lastRunAt = now;

    try {
      await this.userService.cleanupExpiredGuests();
    } catch (error) {
      this.logger.warn('Guest cleanup failed', error as Error);
    } finally {
      this.isRunning = false;
    }
  }
}
