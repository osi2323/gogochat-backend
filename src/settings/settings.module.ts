import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginHistory } from './entities/login-history.entity';
import { LoginHistoryService } from './login-history.service';
import { LoginHistoryController } from './login-history.controller';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';
import { ForbiddenWordsController } from './forbidden-words.controller';
import { ForbiddenWordsService } from './forbidden-words.service';
import { ForbiddenWord } from './entities/forbidden-word.entity';
import { AdminActionsModule } from '../admin-actions/admin-actions.module';
import { ForbiddenNickname } from './entities/forbidden-nickname.entity';
import { ForbiddenNicknamesService } from './forbidden-nicknames.service';
import { ForbiddenNicknamesController } from './forbidden-nicknames.controller';
import { SystemSettings } from './entities/system-settings.entity';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';
import { SecuritySettings } from './entities/security-settings.entity';
import { SecuritySettingsService } from './security-settings.service';
import { SecuritySettingsController } from './security-settings.controller';
import { RadioSettings } from './entities/radio-settings.entity';
import { RadioSettingsService } from './radio-settings.service';
import { RadioSettingsController } from './radio-settings.controller';
import { IpLookupCache } from './entities/ip-lookup-cache.entity';
import { FloodBan } from './entities/flood-ban.entity';
import { IpLookupService } from './ip-lookup.service';
import { User } from '../user/entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { AdminAction } from '../admin-actions/entities/admin-action.entity';
import { UserBan } from '../moderation/entities/user-ban.entity';
import { ModerationModule } from '../moderation/moderation.module';
import { RoomsModule } from '../rooms/rooms.module';
import { Message } from '../messages/entities/message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoginHistory,
      ForbiddenWord,
      ForbiddenNickname,
      SystemSettings,
      SecuritySettings,
      RadioSettings,
      IpLookupCache,
      FloodBan,
      User,
      Role,
      AdminAction,
      UserBan,
      Message,
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => AuthModule),
    forwardRef(() => ModerationModule),
    forwardRef(() => RoomsModule),
    AdminActionsModule,
  ],
  controllers: [
    LoginHistoryController,
    ForbiddenWordsController,
    ForbiddenNicknamesController,
    SystemSettingsController,
    SecuritySettingsController,
    RadioSettingsController,
  ],
  providers: [
    LoginHistoryService,
    ForbiddenWordsService,
    ForbiddenNicknamesService,
    SystemSettingsService,
    SecuritySettingsService,
    RadioSettingsService,
    IpLookupService,
  ],
  exports: [
    LoginHistoryService,
    ForbiddenWordsService,
    ForbiddenNicknamesService,
    SystemSettingsService,
    SecuritySettingsService,
    RadioSettingsService,
    IpLookupService,
  ],
})
export class SettingsModule {}
