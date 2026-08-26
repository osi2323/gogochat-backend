import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomResponseDto } from './dto/room-response.dto';
import { VerifyRoomPasswordDto } from './dto/verify-room-password.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CheckRoomAccessDto } from './dto/check-room-access.dto';
import { UserService } from '../user/user.service';
import {
  hasPermissionForUser,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

type UploadedFile = {
  originalname: string;
  buffer: Buffer;
};

type RoomUploads = {
  roomImageFile?: UploadedFile[];
  logoFile?: UploadedFile[];
};

@ApiTags('Rooms')
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly userService: UserService,
  ) {}

  private async getPermissionContext(req: any): Promise<{
    isRoot: boolean;
    user: any | null;
  }> {
    const username = String(req?.user?.username || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    const isRoot = username === 'root';
    if (isRoot) return { isRoot: true, user: null };

    const userId = Number(req?.user?.sub);
    const user = await this.userService.findById(userId);
    return { isRoot: false, user };
  }

  private ensureRoomManagementPermission(context: {
    isRoot: boolean;
    user: any | null;
  }): void {
    if (context.isRoot) return;
    if (!hasPermissionForUser(context.user, PERMISSION_LABELS.ADMIN_PANEL)) {
      throw new ForbiddenException('Admin paneli erişim yetkiniz yok.');
    }
    if (!hasPermissionForUser(context.user, PERMISSION_LABELS.ROOM_MANAGEMENT)) {
      throw new ForbiddenException('Oda yönetimi yetkiniz yok.');
    }
  }

  private ensureRoomEncryptionPermission(context: {
    isRoot: boolean;
    user: any | null;
  }): void {
    if (context.isRoot) return;
    if (!hasPermissionForUser(context.user, PERMISSION_LABELS.ROOM_ENCRYPTION)) {
      throw new ForbiddenException('Oda şifreleme yetkiniz yok.');
    }
  }

  private ensureRadioManagementPermission(context: {
    isRoot: boolean;
    user: any | null;
  }): void {
    if (context.isRoot) return;
    if (!hasPermissionForUser(context.user, PERMISSION_LABELS.RADIO_MANAGEMENT)) {
      throw new ForbiddenException('Radyo yönetimi yetkiniz yok.');
    }
  }

  private ensureRoomDeletePermission(context: {
    isRoot: boolean;
    user: any | null;
  }): void {
    if (context.isRoot) return;
    if (!hasPermissionForUser(context.user, PERMISSION_LABELS.ROOM_DELETE)) {
      throw new ForbiddenException('Oda silme yetkiniz yok.');
    }
  }

  private hasCreateRoomEncryptionMutation(dto: CreateRoomDto): boolean {
    return (
      dto.isPrivate === true ||
      String(dto.password ?? '').trim().length > 0
    );
  }

  private hasUpdateRoomEncryptionMutation(dto: UpdateRoomDto): boolean {
    const hasIsPrivateChange = Object.prototype.hasOwnProperty.call(
      dto ?? {},
      'isPrivate',
    );
    const hasPasswordChange = Object.prototype.hasOwnProperty.call(
      dto ?? {},
      'password',
    );
    return hasIsPrivateChange || hasPasswordChange;
  }

  private hasCreateRoomRadioMutation(dto: CreateRoomDto): boolean {
    return (
      String(dto.radioPanelLink ?? '').trim().length > 0 ||
      String(dto.radioRequestLink ?? '').trim().length > 0
    );
  }

  private hasUpdateRoomRadioMutation(dto: UpdateRoomDto): boolean {
    const hasPanelChange = Object.prototype.hasOwnProperty.call(
      dto ?? {},
      'radioPanelLink',
    );
    const hasRequestChange = Object.prototype.hasOwnProperty.call(
      dto ?? {},
      'radioRequestLink',
    );
    return hasPanelChange || hasRequestChange;
  }

  @Get()
  @ApiOperation({ summary: 'Oda listesini getir' })
  findAll(): Promise<RoomResponseDto[]> {
    return this.roomsService.findAll();
  }

  @Get('exists')
  @ApiOperation({ summary: 'Oda adı mevcut mu kontrol et' })
  async exists(
    @Query('name') name: string,
  ): Promise<{ exists: boolean; voiceId: string | null }> {
    return this.roomsService.existsByName(name);
  }

  @Get('radio-panel-link')
  @ApiOperation({ summary: 'Oda adına göre radio panel linkini getir' })
  async getRadioPanelLink(
    @Query('name') name: string,
  ): Promise<{ radioPanelLink: string | null }> {
    return this.roomsService.getRadioPanelLinkByName(name);
  }

  @Get('radio-request-link')
  @ApiOperation({ summary: 'Oda adına göre radyo istek paneli linkini getir' })
  async getRadioRequestLink(
    @Query('name') name: string,
  ): Promise<{ radioRequestLink: string | null }> {
    return this.roomsService.getRadioRequestLinkByName(name);
  }

  @Post('verify-password')
  @ApiOperation({ summary: 'Oda şifresini doğrula' })
  verifyPassword(
    @Body() verifyRoomPasswordDto: VerifyRoomPasswordDto,
  ): Promise<{ isValid: boolean }> {
    return this.roomsService.verifyRoomPassword(
      verifyRoomPasswordDto.roomName,
      verifyRoomPasswordDto.password,
    );
  }

  @Post('access-check')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mevcut kullanıcının odaya erişimini doğrula' })
  async checkAccess(
    @Request() req,
    @Body() dto: CheckRoomAccessDto,
  ): Promise<{
    allowed: boolean;
    reason?: 'minimum_star_required' | 'meeting_permission_required';
    requiredMinStar: number;
    userStarCount: number;
    roomId: number | null;
    roomName: string | null;
    redirectRoomSlug?: string;
  }> {
    const userId = Number(req.user.sub);
    return this.roomsService.checkRoomAccess({
      userId,
      roomId: dto.roomId,
      room: dto.room,
      roomName: dto.roomName,
    });
  }

  @Get('livekit-token')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'LiveKit oda token üret' })
  async getLivekitToken(
    @Query('room') room: string,
    @Query('canPublish') canPublish: string,
    @Request() req,
  ): Promise<{ token: string }> {
    const identity: string = req.user.username;
    return this.roomsService.generateLivekitToken(room, identity, canPublish !== 'false');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Oda detayını getir' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<RoomResponseDto> {
    return this.roomsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'roomImageFile', maxCount: 1 },
        { name: 'logoFile', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  @ApiBody({
    description:
      'Yeni oda oluşturma isteği. Oda resmi ve logo link veya dosya olarak gönderilebilir.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        ownerName: { type: 'string' },
        description: { type: 'string' },
        maxUsers: { type: 'number', default: 200 },
        visibleUserCount: { type: 'number', default: 15 },
        isPrivate: { type: 'boolean', default: false },
        password: { type: 'string' },
        radioPanelLink: { type: 'string' },
        radioRequestLink: { type: 'string' },
        listOrder: { type: 'number' },
        minStar: { type: 'number', default: 0 },
        backgroundColor: { type: 'string' },
        roomImage: { type: 'string', description: 'Oda resmi linki' },
        logo: { type: 'string', description: 'Logo linki' },
        roomImageFile: { type: 'string', format: 'binary' },
        logoFile: { type: 'string', format: 'binary' },
      },
      required: ['name', 'listOrder'],
    },
  })
  @ApiOperation({ summary: 'Yeni oda oluştur' })
  async create(
    @Request() req,
    @Body() createRoomDto: CreateRoomDto,
    @UploadedFiles() files: RoomUploads,
  ): Promise<RoomResponseDto> {
    const permissionContext = await this.getPermissionContext(req);
    this.ensureRoomManagementPermission(permissionContext);
    if (this.hasCreateRoomEncryptionMutation(createRoomDto)) {
      this.ensureRoomEncryptionPermission(permissionContext);
    }
    if (this.hasCreateRoomRadioMutation(createRoomDto)) {
      this.ensureRadioManagementPermission(permissionContext);
    }
    return this.roomsService.create(createRoomDto, files);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'roomImageFile', maxCount: 1 },
        { name: 'logoFile', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  @ApiBody({
    description:
      'Oda güncelleme isteği. Oda resmi ve logo link veya dosya olarak gönderilebilir.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        ownerName: { type: 'string' },
        description: { type: 'string' },
        maxUsers: { type: 'number' },
        visibleUserCount: { type: 'number' },
        isPrivate: { type: 'boolean' },
        password: { type: 'string' },
        radioPanelLink: { type: 'string' },
        radioRequestLink: { type: 'string' },
        listOrder: { type: 'number' },
        minStar: { type: 'number' },
        backgroundColor: { type: 'string' },
        roomImage: { type: 'string', description: 'Oda resmi linki' },
        logo: { type: 'string', description: 'Logo linki' },
        roomImageFile: { type: 'string', format: 'binary' },
        logoFile: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Odayı güncelle' })
  async update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoomDto: UpdateRoomDto,
    @UploadedFiles() files: RoomUploads,
  ): Promise<RoomResponseDto> {
    const permissionContext = await this.getPermissionContext(req);
    this.ensureRoomManagementPermission(permissionContext);
    if (this.hasUpdateRoomEncryptionMutation(updateRoomDto)) {
      this.ensureRoomEncryptionPermission(permissionContext);
    }
    if (this.hasUpdateRoomRadioMutation(updateRoomDto)) {
      this.ensureRadioManagementPermission(permissionContext);
    }
    return this.roomsService.update(id, updateRoomDto, files);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Odayı sil' })
  async remove(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    const permissionContext = await this.getPermissionContext(req);
    this.ensureRoomManagementPermission(permissionContext);
    this.ensureRoomDeletePermission(permissionContext);
    return this.roomsService.remove(id);
  }
}
