import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { BackupCronService } from './backup-cron.service';
import { CleanupCronService } from './cleanup-cron.service';
import { Role } from '../role/entities/role.entity';
import { User } from '../user/entities/user.entity';
import { Bot } from '../bot/entities/bot.entity';
import { SystemSettings } from '../settings/entities/system-settings.entity';
import { StatusMode } from '../status-mode/entities/status-mode.entity';
import { Message } from '../messages/entities/message.entity';
import { RoomsModule } from '../rooms/rooms.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      User,
      Bot,
      SystemSettings,
      StatusMode,
      Message,
    ]),
    forwardRef(() => RoomsModule),
    forwardRef(() => AuthModule),
    forwardRef(() => UserModule),
    forwardRef(() => SettingsModule),
  ],
  controllers: [BackupController],
  providers: [BackupService, BackupCronService, CleanupCronService],
  exports: [BackupService],
})
export class BackupModule {}