import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Inject,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ForbiddenWordsService } from './forbidden-words.service';
import { CreateForbiddenWordDto } from './dto/create-forbidden-word.dto';
import { ForbiddenWordResponseDto } from './dto/forbidden-word-response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { StarCountGuard } from '../common/guards/star-count.guard';
import { MinStarCount } from '../common/decorators/min-star-count.decorator';
import { AdminActionsService } from '../admin-actions/admin-actions.service';
import { AdminActionType } from '../admin-actions/enums/admin-action-type.enum';
import { Public } from '../common/decorators/public.decorator';
import { UserService } from '../user/user.service';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';
import { RoomsGateway } from '../rooms/rooms.gateway';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('forbidden-words')
@UseGuards(AuthGuard, StarCountGuard)
@MinStarCount(3)
export class ForbiddenWordsController {
  constructor(
    private readonly forbiddenWordsService: ForbiddenWordsService,
    private readonly adminActionsService: AdminActionsService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => RoomsGateway))
    private readonly roomsGateway: RoomsGateway,
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

  private async ensureWordBanPermission(req: any): Promise<void> {
    const normalizedUsername = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (normalizedUsername === 'root') return;
    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    if (!hasPermissionForUser(user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
    if (!hasPermissionForUser(user, PERMISSION_LABELS.WORD_BAN)) {
      throw new ForbiddenException('Kelime yasaklama yetkiniz yok.');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Yasaklı kelimeleri listele' })
  @ApiResponse({
    status: 200,
    description: 'Yasaklı kelimeler listelendi',
    type: [ForbiddenWordResponseDto],
  })
  @Public()
  @MinStarCount(0)
  findAll(): Promise<ForbiddenWordResponseDto[]> {
    return this.forbiddenWordsService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yeni yasaklı kelime ekle' })
  @ApiResponse({
    status: 201,
    description: 'Yasaklı kelime eklendi',
    type: ForbiddenWordResponseDto,
  })
  async create(
    @Body() createForbiddenWordDto: CreateForbiddenWordDto,
    @Request() req,
  ): Promise<ForbiddenWordResponseDto> {
    await this.ensureWordBanPermission(req);
    const userId = Number(req?.user?.sub);
    const result = await this.forbiddenWordsService.create(
      createForbiddenWordDto,
      userId,
    );
    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.BANNED_WORD_CREATE,
      description: `Yasaklı kelime eklendi: ${createForbiddenWordDto.forbiddenWord} -> ${createForbiddenWordDto.replacementWord}`,
      metadata: { forbiddenWordId: result.id },
    });
    this.roomsGateway.emitForbiddenWordsUpdated({
      type: 'created',
      forbiddenWordId: result.id,
    });
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Yasaklı kelimeyi sil' })
  @ApiResponse({
    status: 204,
    description: 'Yasaklı kelime silindi',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<void> {
    await this.ensureWordBanPermission(req);
    const userId = Number(req?.user?.sub);
    const word = await this.forbiddenWordsService.findEntityById(id);
    await this.forbiddenWordsService.remove(id);
    await this.adminActionsService.logAction({
      adminId: userId,
      adminUsername: req?.user?.username,
      actionType: AdminActionType.BANNED_WORD_DELETE,
      description: word
        ? `Yasaklı kelime silindi: ${word.forbiddenWord} -> ${word.replacementWord}`
        : `Yasaklı kelime silindi: #${id}`,
      metadata: { forbiddenWordId: id },
    });
    this.roomsGateway.emitForbiddenWordsUpdated({
      type: 'deleted',
      forbiddenWordId: id,
    });
  }
}
