import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackupService } from './backup.service';

@Injectable()
export class CleanupCronService implements OnModuleInit {
  private readonly logger = new Logger(CleanupCronService.name);

  constructor(private readonly backupService: BackupService) {}

  async onModuleInit() {
    this.logger.log('CleanupCronService initialized');
    
    try {
      await this.backupService.cleanupOldBackups('master', 2);
      this.logger.log('Initial cleanup performed on startup');
    } catch (error) {
      this.logger.error('Failed to perform initial cleanup', error);
    }
  }

  @Cron('0 0 * * *')
  async handleCleanup() {
    this.logger.log('Running daily backup cleanup (keeping last 2 days)...');
    
    try {
      const tenants = ['master'];
      
      for (const tenant of tenants) {
        const result = await this.backupService.cleanupOldBackups(tenant, 2);
        this.logger.log(`Cleanup result for ${tenant}: ${result.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old backups', error);
    }
  }
}