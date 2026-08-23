import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { Bot } from './entities/bot.entity';
import { BotMutePreference } from './entities/bot-mute-preference.entity';
import { Room } from '../rooms/entities/room.entity';
import { Role } from '../role/entities/role.entity';
import { Message } from '../messages/entities/message.entity';
import { RoomsModule } from '../rooms/rooms.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bot, BotMutePreference, Room, Role, Message]),
    forwardRef(() => RoomsModule),
    AuthModule,
    UserModule,
  ],
  controllers: [BotController],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
