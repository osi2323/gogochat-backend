import {
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminActionsService } from './admin-actions.service';
import { AuthGuard } from '../auth/auth.guard';
import { StarCountGuard } from '../common/guards/star-count.guard';
import { MinStarCount } from '../common/decorators/min-star-count.decorator';
import { AdminActionResponseDto } from './dto/admin-action-response.dto';
import { UserService } from '../user/user.service';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@ApiTags('Admin Actions')
@ApiBearerAuth()
@Controller('admin-actions')
@UseGuards(AuthGuard, StarCountGuard)
export class AdminActionsController {
  constructor(
    private readonly adminActionsService: AdminActionsService,
    private readonly userService: UserService,
  ) {}

  private async ensureAdminActionsPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') {
      return;
    }

    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    const hasAdminPanelPermission = hasPermissionForUser(
      user,
      PERMISSION_LABELS.ADMIN_PANEL,
    );
    if (!hasAdminPanelPermission) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }

    const hasAdminActionsPermission = hasPermissionForUser(
      user,
      PERMISSION_LABELS.ADMIN_ACTIONS,
    );
    if (!hasAdminActionsPermission) {
      throw new ForbiddenException('Admin hareketlerini görüntüleme yetkiniz yok.');
    }
  }

  @Get()
  @MinStarCount(1)
  @ApiOperation({ summary: 'Admin işlemlerini listele' })
  @ApiQuery({
    name: 'actionType',
    required: false,
    description: 'İşlem tipi filtresi (opsiyonel)',
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('actionType') actionType: string | undefined,
    @Request() req: any,
  ): Promise<{
    items: AdminActionResponseDto[];
    total: number;
    page: number;
    limit: number;
    pageCount: number;
  }> {
    await this.ensureAdminActionsPermission(req);
    const starCount = (req.fullUser?.role?.starCount as number) ?? 0;
    return this.adminActionsService.findAllPaginated(
      page,
      limit,
      starCount,
      actionType,
    );
  }
}
