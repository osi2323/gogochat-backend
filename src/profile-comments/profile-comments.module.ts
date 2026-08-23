import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';
import { ProfileComment } from './entities/profile-comment.entity';
import { ProfileCommentsController } from './profile-comments.controller';
import { ProfileCommentsService } from './profile-comments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProfileComment, User]),
    UserModule,
    AuthModule,
    FriendsModule,
  ],
  controllers: [ProfileCommentsController],
  providers: [ProfileCommentsService],
})
export class ProfileCommentsModule {}
