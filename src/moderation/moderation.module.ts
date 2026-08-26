import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { UserBan } from './entities/user-ban.entity';
import { User } from '../user/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AdminActionsModule } from '../admin-actions/admin-actions.module';
import { UserModule } from '../user/user.module';
import { ModerationGateway } from './moderation.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserBan, User]),
    forwardRef(() => AuthModule),
    forwardRef(() => AdminActionsModule),
    forwardRef(() => UserModule),
    forwardRef(() => RoomsModule),
    forwardRef(() => SettingsModule),
  ],
  controllers: [ModerationController],
  providers: [ModerationService, ModerationGateway],
  exports: [ModerationService, ModerationGateway],
})
export class ModerationModule {}
