import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DirectConversation } from './entities/direct-conversation.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { DirectMessagesService } from './direct-messages.service';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesGateway } from './direct-messages.gateway';
import { User } from '../user/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { SettingsModule } from '../settings/settings.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DirectConversation, DirectMessage, User]),
    AuthModule,
    FriendsModule,
    SettingsModule,
    RoomsModule,
  ],
  controllers: [DirectMessagesController],
  providers: [DirectMessagesService, DirectMessagesGateway],
  exports: [DirectMessagesService],
})
export class DirectMessagesModule {}
