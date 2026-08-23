import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageClear } from './entities/message-clear.entity';
import { RoomMessageVisibilitySession } from './entities/room-message-visibility-session.entity';
import { Room } from '../rooms/entities/room.entity';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { SettingsModule } from '../settings/settings.module';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Message,
      MessageRead,
      MessageClear,
      RoomMessageVisibilitySession,
      Room,
      User,
    ]),
    AuthModule,
    forwardRef(() => RoomsModule),
    SettingsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
