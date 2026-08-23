import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminActionsModule } from '../admin-actions/admin-actions.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { StarCountGuard } from '../common/guards/star-count.guard';
import { StatusModeService } from './status-mode.service';
import { StatusModeController } from './status-mode.controller';
import { StatusMode } from './entities/status-mode.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StatusMode]),
    AdminActionsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UserModule),
  ],
  controllers: [StatusModeController],
  providers: [StatusModeService, StarCountGuard],
  exports: [StatusModeService],
})
export class StatusModeModule {}
