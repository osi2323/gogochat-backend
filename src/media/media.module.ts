import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { MediaAsset } from './media.entity';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaAsset]),
    AuthModule,
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [
    MediaService,
    TypeOrmModule,
  ],
})
export class MediaModule {}
