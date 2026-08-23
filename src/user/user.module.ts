import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AdminActionsModule } from '../admin-actions/admin-actions.module';
import { StatusModeModule } from '../status-mode/status-mode.module';
import { RoomsModule } from '../rooms/rooms.module';
import { Role } from '../role/entities/role.entity';
import { GuestCleanupService } from './guest-cleanup.service';
import { SystemSettings } from '../settings/entities/system-settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, SystemSettings]),
    forwardRef(() => AuthModule),
    forwardRef(() => AdminActionsModule),
    forwardRef(() => StatusModeModule),
    forwardRef(() => RoomsModule),
  ],
  controllers: [UserController],
  providers: [UserService, GuestCleanupService],
  exports: [UserService, GuestCleanupService],
})
export class UserModule {}
