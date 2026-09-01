import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomResponseDto } from './dto/room-response.dto';
import { UserService } from '../user/user.service';
import { TenantContext } from '../tenant/tenant-context';
import { generateUniqueVoiceId } from '../common/utils/voice-id.util';
import {
  hasPermissionForUser,
  isMeetingRoomName,
  PERMISSION_LABELS,
} from '../common/utils/permission.util';

type UploadedFile = {
  originalname: string;
  buffer: Buffer;
};

type RoomFileFields = {
  roomImageFile?: UploadedFile[];
  logoFile?: UploadedFile[];
};

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly userService: UserService,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(
    createRoomDto: CreateRoomDto,
    files?: RoomFileFields,
    options?: { skipOwnerValidation?: boolean },
  ): Promise<RoomResponseDto> {
    const ownerId = await this.resolveOwnerIdByName(
      createRoomDto.ownerName,
      options?.skipOwnerValidation,
    );
    this.ensureVisibleCountIsValid(
      createRoomDto.maxUsers,
      createRoomDto.visibleUserCount,
    );

    const voiceId = await this.resolveVoiceId();

    const room = this.roomRepository.create({
      name: createRoomDto.name.trim(),
      ownerId,
      description: this.cleanString(createRoomDto.description),
      maxUsers: createRoomDto.maxUsers ?? 200,
      visibleUserCount: createRoomDto.visibleUserCount ?? 15,
      microphoneLimit: Math.max(1, Math.min(20, Number(createRoomDto.microphoneLimit ?? 5))),
      microphoneStageHidden: createRoomDto.microphoneStageHidden ?? false,
      isPrivate: createRoomDto.isPrivate ?? false,
      isEditable: true,
      password: this.resolvePassword(
        createRoomDto.isPrivate ?? false,
        createRoomDto.password,
      ),
      radioPanelLink: this.cleanString(createRoomDto.radioPanelLink),
      radioRequestLink: this.cleanString(createRoomDto.radioRequestLink),
      listOrder: createRoomDto.listOrder,
      minStar: createRoomDto.minStar ?? 0,
      backgroundColor: this.cleanString(createRoomDto.backgroundColor),
      roomImage: this.cleanString(createRoomDto.roomImage),
      logo: this.cleanString(createRoomDto.logo),
      voiceId,
    });

    await this.handleMediaUploads(room, files);

    const saved = await this.roomRepository.save(room);
    const withOwner = await this.roomRepository.findOne({
      where: { id: saved.id },
      relations: ['owner', 'owner.role'],
    });

    return this.toResponse(withOwner);
  }

  async findAll(): Promise<RoomResponseDto[]> {
    const rooms = await this.roomRepository.find({
      relations: ['owner', 'owner.role'],
      order: { listOrder: 'ASC', id: 'ASC' },
    });
    return rooms.map((room) => this.toResponse(room));
  }

  async findOne(id: number): Promise<RoomResponseDto> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: ['owner', 'owner.role'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.toResponse(room);
  }

  async update(
    id: number,
    updateRoomDto: UpdateRoomDto,
    files?: RoomFileFields,
    options?: { skipOwnerValidation?: boolean },
  ): Promise<RoomResponseDto> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: ['owner', 'owner.role'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.isEditable === false) {
      throw new BadRequestException('Room is not editable');
    }

    console.log('🔥 ROOM UPDATE DTO:', updateRoomDto);
    console.log('🔥 GELEN OWNER NAME:', updateRoomDto.ownerName);

    if (updateRoomDto.ownerName !== undefined) {
      const cleanedOwnerName = this.cleanString(updateRoomDto.ownerName);

      if (!cleanedOwnerName) {
        room.ownerId = undefined;
        room.owner = undefined;
      } else {
        const resolvedOwner =
          await this.userService.findByUsernameCaseInsensitive(cleanedOwnerName);

        console.log(
          '🔥 BULUNAN OWNER:',
          resolvedOwner?.id,
          resolvedOwner?.username,
        );

        if (!resolvedOwner || resolvedOwner.isGuest === true) {
          if (!options?.skipOwnerValidation) {
            throw new NotFoundException('Owner not found');
          }
        } else {
          // ÖNEMLİ:
          // Oda entity'si owner relation'ı ile birlikte yükleniyor.
          // Sadece ownerId değiştirilirse eski room.owner (örn. root)
          // TypeORM save sırasında tekrar ownerId'yi eski kullanıcıya çevirebilir.
          // Bu yüzden ownerId ve owner relation'ını birlikte güncelliyoruz.
          room.ownerId = resolvedOwner.id;
          room.owner = resolvedOwner;
        }
      }
    }

    const maxUsers = updateRoomDto.maxUsers ?? room.maxUsers;
    const visibleUserCount =
      updateRoomDto.visibleUserCount ?? room.visibleUserCount;
    this.ensureVisibleCountIsValid(maxUsers, visibleUserCount);

    room.name = updateRoomDto.name?.trim() ?? room.name;
    room.description =
      this.cleanString(updateRoomDto.description) ?? room.description;
    room.maxUsers = maxUsers;
    room.visibleUserCount = visibleUserCount;
    room.microphoneLimit = Math.max(1, Math.min(20, Number(updateRoomDto.microphoneLimit ?? room.microphoneLimit ?? 5)));
    room.microphoneStageHidden =
      updateRoomDto.microphoneStageHidden ?? room.microphoneStageHidden ?? false;
    room.isPrivate = updateRoomDto.isPrivate ?? room.isPrivate;
    if (updateRoomDto.isEditable !== undefined) {
      room.isEditable = updateRoomDto.isEditable;
    }
    room.password = this.resolvePassword(
      room.isPrivate,
      updateRoomDto.password ?? room.password,
    );
    if (Object.prototype.hasOwnProperty.call(updateRoomDto, 'radioPanelLink')) {
      room.radioPanelLink =
        this.cleanString(updateRoomDto.radioPanelLink) ?? null;
    }
    if (
      Object.prototype.hasOwnProperty.call(updateRoomDto, 'radioRequestLink')
    ) {
      room.radioRequestLink =
        this.cleanString(updateRoomDto.radioRequestLink) ?? null;
    }
    room.listOrder = updateRoomDto.listOrder ?? room.listOrder;
    room.minStar = updateRoomDto.minStar ?? room.minStar;
    room.backgroundColor =
      this.cleanString(updateRoomDto.backgroundColor) ?? room.backgroundColor;

    const requestedRoomImage =
      updateRoomDto.roomImage !== undefined
        ? (this.cleanString(updateRoomDto.roomImage) ?? '')
        : undefined;
    const requestedLogo =
      updateRoomDto.logo !== undefined
        ? (this.cleanString(updateRoomDto.logo) ?? '')
        : undefined;

    if (requestedRoomImage !== undefined) {
      await this.replaceMediaIfNeeded('roomImage', room, requestedRoomImage);
    }
    if (requestedLogo !== undefined) {
      await this.replaceMediaIfNeeded('logo', room, requestedLogo);
    }

    await this.handleMediaUploads(room, files);

    room.updatedAt = new Date();
    await this.roomRepository.save(room);

    const withOwner = await this.roomRepository.findOne({
      where: { id: room.id },
      relations: ['owner', 'owner.role'],
    });

    return this.toResponse(withOwner);
  }

  async remove(id: number): Promise<void> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: ['owner', 'owner.role'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.isEditable === false) {
      throw new BadRequestException('Room is not deletable');
    }

    await this.deleteLocalFileIfExists(room.roomImage);
    await this.deleteLocalFileIfExists(room.logo);

    await this.roomRepository.softDelete(id);
  }

  private toResponse(room: Room | null): RoomResponseDto {
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return {
      id: room.id,
      name: room.name,
      voiceId: room.voiceId ?? null,
      ownerId: room.ownerId ?? null,
      owner: room.owner
        ? {
            id: room.owner.id,
            username: room.owner.username,
            gender: room.owner.gender,
            icon: room.owner.icon ?? null,
            role: room.owner.role
              ? {
                  id: room.owner.role.id,
                  name: room.owner.role.name,
                  microphoneDuration: room.owner.role.microphoneDuration,
                  starColor: room.owner.role.starColor,
                  starCount: room.owner.role.starCount,
                  icon: room.owner.role.icon,
                  permissions: room.owner.role.permissions,
                }
              : null,
          }
        : null,
      description: room.description ?? null,
      maxUsers: room.maxUsers,
      visibleUserCount: room.visibleUserCount,
      microphoneLimit: room.microphoneLimit ?? 5,
      microphoneStageHidden: room.microphoneStageHidden ?? false,
      isPrivate: room.isPrivate,
      isEditable: room.isEditable,
      radioPanelLink: room.radioPanelLink ?? null,
      radioRequestLink: room.radioRequestLink ?? null,
      listOrder: room.listOrder,
      minStar: room.minStar,
      backgroundColor: room.backgroundColor ?? null,
      roomImage: room.roomImage ?? null,
      logo: room.logo ?? null,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  private resolvePassword(
    isPrivate: boolean,
    password?: string | null,
  ): string | null {
    if (!isPrivate) {
      return null;
    }

    const trimmed = this.cleanString(password);
    return trimmed ?? null;
  }

  private ensureVisibleCountIsValid(
    maxUsers?: number,
    visibleUserCount?: number,
  ) {
    if (
      maxUsers !== undefined &&
      visibleUserCount !== undefined &&
      visibleUserCount > maxUsers
    ) {
      throw new BadRequestException(
        'Visible user count cannot be greater than max users',
      );
    }
  }

  private cleanString(value?: string | null): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }

  private normalizeRoomLookup(value?: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed.toLowerCase() : null;
  }

  private isUrl(value?: string | null): boolean {
    if (!value) {
      return false;
    }

    return /^https?:\/\//i.test(value);
  }

  private isDataUrl(value?: string | null): boolean {
    if (!value) {
      return false;
    }

    return /^data:[^;]+;base64,/i.test(value);
  }

  async existsByName(
    name?: string,
  ): Promise<{ exists: boolean; voiceId: string | null }> {
    const cleanedName = this.cleanString(name);
    if (!cleanedName) {
      throw new BadRequestException('Room name is required');
    }

    const room = await this.roomRepository.findOne({
      where: { name: cleanedName },
      select: ['id', 'voiceId'],
    });

    return { exists: !!room, voiceId: room?.voiceId ?? null };
  }

  async checkRoomAccess(params: {
    userId: number;
    roomId?: string;
    room?: string;
    roomName?: string;
  }): Promise<{
    allowed: boolean;
    reason?: 'minimum_star_required' | 'meeting_permission_required';
    requiredMinStar: number;
    userStarCount: number;
    roomId: number | null;
    roomName: string | null;
    redirectRoomSlug?: string;
  }> {
    const room = await this.findRoomForAccessCheck(params);
    const user = await this.userService.findById(params.userId);
    const username = user?.username?.trim().toLowerCase() ?? '';
    const userStarCount = user?.isGuest ? 0 : (user?.role?.starCount ?? 0);

    if (!room) {
      return {
        allowed: true,
        requiredMinStar: 0,
        userStarCount,
        roomId: null,
        roomName: params.roomName?.trim() || null,
      };
    }

    if (username === 'root') {
      return {
        allowed: true,
        requiredMinStar: room.minStar ?? 0,
        userStarCount,
        roomId: room.id,
        roomName: room.name,
      };
    }

    const requiredMinStar = room.minStar ?? 0;
    if (requiredMinStar > 0 && userStarCount < requiredMinStar) {
      return {
        allowed: false,
        reason: 'minimum_star_required',
        requiredMinStar,
        userStarCount,
        roomId: room.id,
        roomName: room.name,
        redirectRoomSlug: undefined,
      };
    }

    if (
      isMeetingRoomName(room.name) &&
      !hasPermissionForUser(user, PERMISSION_LABELS.MEETING_ROOM)
    ) {
      return {
        allowed: false,
        reason: 'meeting_permission_required',
        requiredMinStar,
        userStarCount,
        roomId: room.id,
        roomName: room.name,
        redirectRoomSlug: undefined,
      };
    }

    return {
      allowed: true,
      requiredMinStar,
      userStarCount,
      roomId: room.id,
      roomName: room.name,
    };
  }

  async getRadioPanelLinkByName(
    name?: string,
  ): Promise<{ radioPanelLink: string | null }> {
    const cleanedName = this.cleanString(name);
    if (!cleanedName) {
      throw new BadRequestException('Room name is required');
    }

    const room = await this.roomRepository.findOne({
      where: { name: cleanedName },
      select: ['id', 'radioPanelLink'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return { radioPanelLink: room.radioPanelLink ?? null };
  }

  async getRadioRequestLinkByName(
    name?: string,
  ): Promise<{ radioRequestLink: string | null }> {
    const cleanedName = this.cleanString(name);
    if (!cleanedName) {
      throw new BadRequestException('Room name is required');
    }

    const room = await this.roomRepository.findOne({
      where: { name: cleanedName },
      select: ['id', 'radioRequestLink'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return { radioRequestLink: room.radioRequestLink ?? null };
  }

  async verifyRoomPassword(
    roomName: string,
    password: string,
  ): Promise<{ isValid: boolean }> {
    const cleanedName = this.cleanString(roomName);
    if (!cleanedName) {
      throw new BadRequestException('Room name is required');
    }

    const room = await this.roomRepository.findOne({
      where: { name: cleanedName },
      select: ['id', 'isPrivate', 'password'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Oda private değilse şifre kontrolüne gerek yok
    if (!room.isPrivate) {
      return { isValid: true };
    }

    // Private oda ise şifre kontrolü yap
    const isValid = room.password === password?.trim();
    return { isValid };
  }

  private async findRoomForAccessCheck(params: {
    roomId?: string;
    room?: string;
    roomName?: string;
  }): Promise<Room | null> {
    const parsedRoomId = Number(params.roomId);
    if (Number.isInteger(parsedRoomId) && parsedRoomId > 0) {
      const roomById = await this.roomRepository.findOne({
        where: { id: parsedRoomId },
      });
      if (roomById) {
        return roomById;
      }
    }

    const normalizedCandidates = Array.from(
      new Set(
        [
          this.normalizeRoomLookup(params.room),
          this.normalizeRoomLookup(params.room)?.replace(/-/g, ' ') ?? null,
          this.normalizeRoomLookup(params.roomName),
          this.normalizeRoomLookup(params.roomName)?.replace(/\s+/g, '-') ??
            null,
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    const rawCandidates = Array.from(
      new Set(
        [params.room?.trim(), params.roomName?.trim()].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    );

    if (!normalizedCandidates.length && !rawCandidates.length) {
      return null;
    }

    return this.roomRepository
      .createQueryBuilder('room')
      .where(
        new Brackets((qb) => {
          if (normalizedCandidates.length > 0) {
            qb.where('LOWER(room.name) IN (:...nameCandidates)', {
              nameCandidates: normalizedCandidates,
            });
          }

          if (rawCandidates.length > 0) {
            qb.orWhere('room.voiceId IN (:...voiceIdCandidates)', {
              voiceIdCandidates: rawCandidates,
            }).orWhere('LOWER(room.voiceId) IN (:...normalizedVoiceIdCandidates)', {
              normalizedVoiceIdCandidates: rawCandidates.map((value) =>
                value.toLowerCase(),
              ),
            });
          }
        }),
      )
      .getOne();
  }

  private async handleMediaUploads(
    room: Room,
    files?: RoomFileFields,
  ): Promise<void> {
    const tenant = this.tenantContext.getTenant() ?? 'public';

    // Eğer roomImage veya logo data URL olarak geldiyse dosya olarak kaydet
    if (this.isDataUrl(room.roomImage)) {
      room.roomImage = await this.saveDataUrlAndReturnPath(
        room.roomImage as string,
        tenant,
      );
    }

    if (this.isDataUrl(room.logo)) {
      room.logo = await this.saveDataUrlAndReturnPath(
        room.logo as string,
        tenant,
      );
    }

    if (!files) {
      return;
    }

    if (files.roomImageFile?.[0]) {
      await this.replaceFile('roomImage', room, files.roomImageFile[0], tenant);
    }

    if (files.logoFile?.[0]) {
      await this.replaceFile('logo', room, files.logoFile[0], tenant);
    }
  }

  private async replaceMediaIfNeeded(
    key: 'roomImage' | 'logo',
    room: Room,
    newValue?: string,
  ) {
    if (newValue === undefined) {
      return;
    }

    if (!newValue) {
      await this.deleteLocalFileIfExists(room[key]);
      room[key] = null;
      return;
    }

    const tenant = this.tenantContext.getTenant() ?? 'public';

    if (this.isDataUrl(newValue)) {
      await this.deleteLocalFileIfExists(room[key]);
      room[key] = await this.saveDataUrlAndReturnPath(newValue, tenant);
      return;
    }

    await this.deleteLocalFileIfExists(room[key]);
    room[key] = newValue;
  }

  private async replaceFile(
    key: 'roomImage' | 'logo',
    room: Room,
    file: UploadedFile,
    tenant: string,
  ) {
    await this.deleteLocalFileIfExists(room[key]);
    room[key] = await this.saveFileAndReturnPath(file, tenant);
  }

  private async deleteLocalFileIfExists(filePath?: string | null) {
    if (!filePath || this.isUrl(filePath)) {
      return;
    }

    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    try {
      await fs.unlink(resolvedPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async saveFileAndReturnPath(
    file: UploadedFile,
    tenant: string,
  ): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'rooms', tenant);
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.originalname || '');
    const filename = `${Date.now()}-${randomUUID()}${ext}`;
    const fullPath = path.join(uploadDir, filename);

    await fs.writeFile(fullPath, file.buffer);

    return path.relative(process.cwd(), fullPath);
  }

  private async saveDataUrlAndReturnPath(
    dataUrl: string,
    tenant: string,
  ): Promise<string> {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
    if (!match) {
      throw new BadRequestException('Invalid data URL');
    }

    const mimeType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const ext = this.mimeToExtension(mimeType);

    const uploadDir = path.join(process.cwd(), 'uploads', 'rooms', tenant);
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}${ext ? `.${ext}` : ''}`;
    const fullPath = path.join(uploadDir, filename);

    await fs.writeFile(fullPath, buffer);

    return path.relative(process.cwd(), fullPath);
  }

  private mimeToExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };

    return map[mimeType] ?? '';
  }

  private async resolveOwnerIdByName(
    ownerName?: string,
    skipOwnerValidation = false,
  ): Promise<number | undefined> {
    const cleanedName = this.cleanString(ownerName);
    if (!cleanedName) {
      return undefined;
    }

    // Oda sahibi kullanıcı adı büyük/küçük harfe duyarlı olmamalı.
    // Misafir hesaplar oda sahibi olarak atanamaz.
    const owner =
      await this.userService.findByUsernameCaseInsensitive(cleanedName);

    if (!owner || owner.isGuest === true) {
      if (skipOwnerValidation) {
        return undefined;
      }
      throw new NotFoundException('Owner not found');
    }

    return owner.id;
  }

  private async resolveVoiceId(): Promise<string> {
    const exists = async (voiceId: string) =>
      this.roomRepository.exist({ where: { voiceId } });

    return generateUniqueVoiceId(exists);
  }

  async generateLivekitToken(
    roomName: string,
    identity: string,
    canPublish = true,
  ): Promise<{ token: string; url: string }> {
    const { AccessToken } = await import('livekit-server-sdk');
    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
    const url = process.env.LIVEKIT_URL?.trim();

    if (!apiKey || !apiSecret || !url) {
      throw new Error(
        'LiveKit yapılandırması eksik: LIVEKIT_URL, LIVEKIT_API_KEY ve LIVEKIT_API_SECRET gerekli',
      );
    }

    const safeRoomName = String(roomName || '').trim();
    if (!safeRoomName) {
      throw new Error('LiveKit oda adı boş olamaz');
    }

    const at = new AccessToken(apiKey, apiSecret, { identity, ttl: '2h' });
    at.addGrant({
      roomJoin: true,
      room: safeRoomName,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });
    return { token: await at.toJwt(), url };
  }
}
