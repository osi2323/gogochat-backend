import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminActionsService } from './admin-actions.service';
import { AdminActionsController } from './admin-actions.controller';
import { AdminAction } from './entities/admin-action.entity';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { StarCountGuard } from '../common/guards/star-count.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminAction]),
    forwardRef(() => AuthModule),
    forwardRef(() => UserModule),
  ],
  controllers: [AdminActionsController],
  providers: [AdminActionsService, StarCountGuard],
  exports: [AdminActionsService, StarCountGuard],
})
export class AdminActionsModule {}
