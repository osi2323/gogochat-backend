import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackupService } from './backup.service';

@Injectable()
export class BackupCronService implements OnModuleInit {
  private readonly logger = new Logger(BackupCronService.name);
  private readonly defaultTenant = 'master';

  constructor(private readonly backupService: BackupService) {}

  async onModuleInit() {
    this.logger.log('BackupCronService initialized');
    
    try {
      await this.backupService.createBackup(this.defaultTenant);
      this.logger.log('Initial backup created on startup');
    } catch (error) {
      this.logger.error('Failed to create initial backup', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyBackup() {
    this.logger.log('Running hourly backup...');
    
    try {
      const tenants = ['master'];
      
      for (const tenant of tenants) {
        const result = await this.backupService.createBackup(tenant);
        this.logger.log(`Backup created for ${tenant}: ${result.filename}`);
      }
    } catch (error) {
      this.logger.error('Failed to create hourly backup', error);
    }
  }
}