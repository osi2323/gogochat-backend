import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../user/entities/user.entity';
import { CallHistoryController } from './call-history.controller';
import { CallHistoryService } from './call-history.service';
import { CallHistory } from './entities/call-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CallHistory, User]), AuthModule],
  controllers: [CallHistoryController],
  providers: [CallHistoryService],
  exports: [CallHistoryService],
})
export class CallHistoryModule {}
