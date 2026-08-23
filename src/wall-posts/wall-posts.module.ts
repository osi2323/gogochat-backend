import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { User } from '../user/entities/user.entity';
import { WallPost } from './entities/wall-post.entity';
import { WallPostLike } from './entities/wall-post-like.entity';
import { WallPostComment } from './entities/wall-post-comment.entity';
import { WallPostView } from './entities/wall-post-view.entity';
import { WallPostsController } from './wall-posts.controller';
import { WallPostsService } from './wall-posts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WallPost,
      WallPostLike,
      WallPostComment,
      WallPostView,
      User,
    ]),
    UserModule,
    AuthModule,
  ],
  controllers: [WallPostsController],
  providers: [WallPostsService],
})
export class WallPostsModule {}
