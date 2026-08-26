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
import { StarCountGuard } from '../common/guards/star-count.guard';
import { MinStarCount } from '../common/decorators/min-star-count.decorator';
import { ForbiddenNicknamesService } from './forbidden-nicknames.service';
import { CreateForbiddenNicknameDto } from './dto/create-forbidden-nickname.dto';
import { ForbiddenNicknameResponseDto } from './dto/forbidden-nickname-response.dto';
import { AdminActionsService } from '../admin-actions/admin-actions.service';
import { AdminActionType } from '../admin-actions/enums/admin-action-type.enum';
import { UserService } from '../user/user.service';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('forbidden-nicknames')
@UseGuards(AuthGuard, StarCountGuard)
@MinStarCount(3)
export class ForbiddenNicknamesController {
  constructor(
    private readonly forbiddenNicknamesService: ForbiddenNicknamesService,
    private readonly adminActionsService: AdminActionsService,
    private readonly userService: UserService,
  ) {}

  private async ensureNicknameBanPermission(req: any): Promise<void> {
    const username = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (username === 'root') return;

    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    if (!hasPermissionForUser(user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
    if (!hasPermissionForUser(user, PERMISSION_LABELS.NICKNAME_BAN)) {
      throw new ForbiddenException('Rumuz yasaklama yetkiniz yok.');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Yasaklı nickleri listele' })
  @ApiResponse({
    status: 200,
    description: 'Yasaklı nickler listelendi',
    type: [ForbiddenNicknameResponseDto],
  })
  findAll(): Promise<ForbiddenNicknameResponseDto[]> {
    return this.forbiddenNicknamesService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yeni yasaklı nick ekle' })
  @ApiResponse({
    status: 201,
    description: 'Yasaklı nick eklendi',
    type: ForbiddenNicknameResponseDto,
  })
  async create(
    @Body() createDto: CreateForbiddenNicknameDto,
    @Request() req,
  ): Promise<ForbiddenNicknameResponseDto> {
    await this.ensureNicknameBanPermission(req);
    const userId = Number(req?.user?.sub);
    const result = await this.forbiddenNicknamesService.create(
      createDto,
      userId,
    );
    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.BANNED_NICK_CREATE,
      description: `Yasaklı nick eklendi: ${createDto.nickname}`,
      metadata: { forbiddenNicknameId: result.id },
    });
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Yasaklı nicki sil' })
  @ApiResponse({
    status: 204,
    description: 'Yasaklı nick silindi',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<void> {
    await this.ensureNicknameBanPermission(req);
    const userId = Number(req?.user?.sub);
    const nickname = await this.forbiddenNicknamesService.findEntityById(id);
    await this.forbiddenNicknamesService.remove(id);
    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.BANNED_NICK_DELETE,
      description: nickname
        ? `Yasaklı nick silindi: ${nickname.nickname}`
        : `Yasaklı nick silindi: #${id}`,
      metadata: { forbiddenNicknameId: id },
    });
  }
}
