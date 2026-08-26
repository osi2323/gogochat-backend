import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { Room } from './entities/room.entity';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { RoomsStateService } from './rooms-state.service';
import { FriendRequest } from '../friends/entities/friend-request.entity';
import { User } from '../user/entities/user.entity';
import { Bot } from '../bot/entities/bot.entity';
import { Role } from '../role/entities/role.entity';
import { Message } from '../messages/entities/message.entity';
import { RoomMessageVisibilitySession } from '../messages/entities/room-message-visibility-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      FriendRequest,
      User,
      Bot,
      Role,
      Message,
      RoomMessageVisibilitySession,
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => TenantModule),
    forwardRef(() => AuthModule),
    forwardRef(() => SettingsModule),
  ],
  controllers: [RoomsController],
  providers: [RoomsGateway, RoomsService, RoomsStateService],
  exports: [RoomsService, RoomsGateway, RoomsStateService],
})
export class RoomsModule {}
