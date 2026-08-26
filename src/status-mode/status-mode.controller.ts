import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { MinStarCount } from '../common/decorators/min-star-count.decorator';
import { StarCountGuard } from '../common/guards/star-count.guard';
import { AdminActionsService } from '../admin-actions/admin-actions.service';
import { AdminActionType } from '../admin-actions/enums/admin-action-type.enum';
import { CreateStatusModeDto } from './dto/create-status-mode.dto';
import { UpdateStatusModeDto } from './dto/update-status-mode.dto';
import { StatusModeService } from './status-mode.service';
import { StatusMode } from './entities/status-mode.entity';
import { Public } from '../common/decorators/public.decorator';
import { UserService } from '../user/user.service';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@ApiTags('Status Modes')
@ApiBearerAuth()
@Controller('status-modes')
@UseGuards(AuthGuard)
export class StatusModeController {
  constructor(
    private readonly statusModeService: StatusModeService,
    private readonly adminActionsService: AdminActionsService,
    private readonly userService: UserService,
  ) {}

  private async ensureAdminPanelPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;
    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    if (!hasPermissionForUser(user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Durum modlarını listele' })
  @ApiResponse({ status: 200, description: 'Durum modları listelendi' })
  @Public()
  findAll(): Promise<StatusMode[]> {
    return this.statusModeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'ID ile durum modu getir' })
  @ApiResponse({ status: 200, description: 'Durum modu getirildi' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<StatusMode> {
    return this.statusModeService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard, StarCountGuard)
  @MinStarCount(3)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yeni durum modu ekle' })
  async create(
    @Body() createStatusModeDto: CreateStatusModeDto,
    @Request() req,
  ): Promise<StatusMode> {
    await this.ensureAdminPanelPermission(req);
    const result = await this.statusModeService.create(createStatusModeDto);

    await this.adminActionsService.logAction({
      adminId: Number(req?.user?.sub),
      adminUsername: req?.user?.username,
      actionType: AdminActionType.STATUS_MODE_CREATE,
      description: `Durum modu eklendi: ${createStatusModeDto.name}`,
      metadata: { statusModeId: result.id },
    });

    return result;
  }

  @Patch(':id')
  @UseGuards(AuthGuard, StarCountGuard)
  @MinStarCount(3)
  @ApiOperation({ summary: 'Durum modu güncelle' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusModeDto: UpdateStatusModeDto,
    @Request() req,
  ): Promise<StatusMode> {
    await this.ensureAdminPanelPermission(req);
    const result = await this.statusModeService.update(id, updateStatusModeDto);

    await this.adminActionsService.logAction({
      adminId: Number(req?.user?.sub),
      adminUsername: req?.user?.username,
      actionType: AdminActionType.STATUS_MODE_UPDATE,
      description: `Durum modu güncellendi: ${result.name}`,
      metadata: { statusModeId: result.id },
    });

    return result;
  }

  @Delete(':id')
  @UseGuards(AuthGuard, StarCountGuard)
  @MinStarCount(3)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Durum modu sil' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<void> {
    await this.ensureAdminPanelPermission(req);
    const statusMode = await this.statusModeService.findOne(id);
    await this.statusModeService.remove(id);

    await this.adminActionsService.logAction({
      adminId: Number(req?.user?.sub),
      adminUsername: req?.user?.username,
      actionType: AdminActionType.STATUS_MODE_DELETE,
      description: `Durum modu silindi: ${statusMode.name}`,
      metadata: { statusModeId: id },
    });
  }
}
