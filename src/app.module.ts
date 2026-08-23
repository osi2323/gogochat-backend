import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import databaseConfig from './config/database.config';
import { DatabaseModule } from './database/database.module';
import { TenantModule } from './tenant/tenant.module';
import { RoomsModule } from './rooms/rooms.module';
import { RoleModule } from './role/role.module';
import { SettingsModule } from './settings/settings.module';
import { AdminActionsModule } from './admin-actions/admin-actions.module';
import { StatusModeModule } from './status-mode/status-mode.module';
import { ModerationModule } from './moderation/moderation.module';
import { MessagesModule } from './messages/messages.module';
import { FriendsModule } from './friends/friends.module';
import { SearchHistoryModule } from './search-history/search-history.module';
import { WallPostsModule } from './wall-posts/wall-posts.module';
import { DirectMessagesModule } from './direct-messages/direct-messages.module';
import { ProfileCommentsModule } from './profile-comments/profile-comments.module';
import { BotModule } from './bot/bot.module';
import { BackupModule } from './backup/backup.module';
import { CallHistoryModule } from './call-history/call-history.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UserModule,
    TenantModule,
    RoomsModule,
    RoleModule,
    SettingsModule,
    AdminActionsModule,
    StatusModeModule,
    ModerationModule,
    MessagesModule,
    FriendsModule,
    SearchHistoryModule,
    WallPostsModule,
    DirectMessagesModule,
    ProfileCommentsModule,
    BotModule,
    BackupModule,
    CallHistoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
