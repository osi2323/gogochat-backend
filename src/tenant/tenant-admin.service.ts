import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateRoomDto } from '../rooms/dto/create-room.dto';
import { RoomResponseDto } from '../rooms/dto/room-response.dto';
import { ConfigService } from '@nestjs/config';
import { Role } from '../role/entities/role.entity';
import { generateUniqueVoiceId } from '../common/utils/voice-id.util';
import { Room } from '../rooms/entities/room.entity';

@Injectable()
export class TenantAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async createTenant(tenant: string) {
    const schema = `tenant_${tenant}`;

    // schema var mı kontrol
    const exists = await this.schemaExists(schema);
    if (exists) throw new BadRequestException('Tenant already exists');

    await this.dataSource.query(`CREATE SCHEMA ${schema}`);

    // Tabloları otomatik oluştur (Synchronize)
    await this.syncSchema(schema);

    return { created: true, schema };
  }

  private async syncSchema(schema: string) {
    // Mevcut bağlantı ayarlarını alıp yeni şema ile birleştiriyoruz
    const tenantDataSource = new DataSource({
      ...this.dataSource.options,
      schema: schema,
      // Mevcut entity'leri yeni bağlantıya aktar
      entities: this.dataSource.entityMetadatas.map((m) => m.target) as any,
    } as any);

    await tenantDataSource.initialize();
    await tenantDataSource.synchronize(); // Tabloları entity'lere göre oluşturur
    await tenantDataSource.destroy();
  }

  async deleteTenant(tenant: string) {
    const schema = `tenant_${tenant}`;

    const exists = await this.schemaExists(schema);
    if (!exists) throw new BadRequestException('Tenant does not exist');

    await this.dataSource.query(`DROP SCHEMA ${schema} CASCADE`);
    return { deleted: true };
  }

  async listTenants() {
    const rows = await this.dataSource.query(`
      SELECT schema_name 
      FROM information_schema.schemata
      WHERE schema_name LIKE 'tenant_%'
    `);

    return rows.map((r) => r.schema_name);
  }

  async schemaExists(schema: string) {
    const r = await this.dataSource.query(
      `SELECT schema_name 
       FROM information_schema.schemata 
       WHERE schema_name = $1`,
      [schema],
    );
    return r.length > 0;
  }

  async createRoomInMaster(dto: CreateRoomDto): Promise<RoomResponseDto> {
    const schema = 'tenant_master';
    const exists = await this.schemaExists(schema);
    if (!exists) {
      throw new NotFoundException('Master tenant schema not found');
    }

    const now = new Date();
    const maxUsers = dto.maxUsers ?? 200;
    const visibleUserCount = dto.visibleUserCount ?? 15;
    const isPrivate = dto.isPrivate ?? false;
    const isEditable = true;
    const password =
      isPrivate && dto.password ? dto.password.trim() || null : null;
    const voiceId = await this.resolveVoiceIdForSchema(schema);

    const columns = [
      'name',
      'voiceId',
      'maxUsers',
      'visibleUserCount',
      'microphoneLimit',
      'microphoneStageHidden',
      'isPrivate',
      'isEditable',
      'listOrder',
      'minStar',
      'createdAt',
      'updatedAt',
    ];
    const values: any[] = [
      dto.name.trim(),
      voiceId,
      maxUsers,
      visibleUserCount,
      Math.max(1, Math.min(20, Number(dto.microphoneLimit ?? 5))),
      dto.microphoneStageHidden ?? false,
      isPrivate,
      isEditable,
      dto.listOrder,
      dto.minStar ?? 0,
      now,
      now,
    ];

    const optionalFields: Array<[string, any]> = [
      ['description', dto.description?.trim() ?? null],
      ['password', password],
      ['radioPanelLink', dto.radioPanelLink?.trim() ?? null],
      ['backgroundColor', dto.backgroundColor?.trim() ?? null],
      ['roomImage', dto.roomImage?.trim() ?? null],
      ['logo', dto.logo?.trim() ?? null],
    ];

    for (const [column, value] of optionalFields) {
      if (value !== undefined) {
        columns.push(column);
        values.push(value);
      }
    }

    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
    const columnsSql = columns.map((c) => `"${c}"`).join(', ');

    const [row] = await this.dataSource.query(
      `INSERT INTO ${schema}."rooms" (${columnsSql})
       VALUES (${placeholders})
       RETURNING *`,
      values,
    );

    return this.mapRoomRow(row);
  }

  private mapRoomRow(row: any): RoomResponseDto {
    const ownerId =
      row.ownerId ?? row.ownerid ?? row.owner_id ?? row.owner ?? null;
    return {
      id: Number(row.id),
      name: row.name,
      ownerId:
        ownerId !== null && ownerId !== undefined ? Number(ownerId) : null,
      owner: null,
      description: row.description ?? null,
      maxUsers: Number(row.maxusers ?? row.maxUsers),
      visibleUserCount: Number(row.visibleusercount ?? row.visibleUserCount),
      microphoneLimit: Number(row.microphonelimit ?? row.microphoneLimit ?? 5),
      microphoneStageHidden:
        row.microphonestagehidden ?? row.microphoneStageHidden ?? false,
      isPrivate: row.isprivate ?? row.isPrivate,
      radioPanelLink: row.radiopanellink ?? row.radioPanelLink ?? null,
      listOrder: Number(row.listorder ?? row.listOrder),
      minStar: Number(row.minstar ?? row.minStar),
      backgroundColor: row.backgroundcolor ?? row.backgroundColor ?? null,
      roomImage: row.roomimage ?? row.roomImage ?? null,
      logo: row.logo ?? null,
      isEditable: row.iseditable ?? row.isEditable ?? true,
      voiceId: row.voiceid ?? row.voiceId,
      createdAt: new Date(row.createdat ?? row.createdAt),
      updatedAt: new Date(row.updatedat ?? row.updatedAt),
    };
  }

  async seedDefaultRoles(schemaInput: string) {
    const schema = this.normalizeSchema(schemaInput);

    const exists = await this.schemaExists(schema);
    if (!exists) {
      throw new NotFoundException('Tenant schema not found');
    }

    const tenantDataSource = new DataSource({
      ...this.dataSource.options,
      schema,
      entities: this.dataSource.entityMetadatas.map((m) => m.target) as any,
    } as any);

    await tenantDataSource.initialize();

    try {
      const roleRepository = tenantDataSource.getRepository(Role);
      const defaultRoles = this.buildDefaultRoles();

      let created = 0;
      for (const role of defaultRoles) {
        const roleExists = await roleRepository.findOne({
          where: { name: role.name },
        });

        if (roleExists) continue;

        await roleRepository.save(roleRepository.create(role));
        created += 1;
      }

      return {
        schema,
        created,
        skipped: defaultRoles.length - created,
        totalDefaultRoles: defaultRoles.length,
      };
    } finally {
      await tenantDataSource.destroy();
    }
  }

  private normalizeSchema(schemaInput: string) {
    const normalized = schemaInput.trim().toLowerCase();
    if (normalized.startsWith('tenant_')) {
      return normalized;
    }
    return `tenant_${normalized}`;
  }

  private async resolveVoiceIdForSchema(schema: string) {
    const exists = async (voiceId: string) => {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM ${schema}."rooms" WHERE "voiceId" = $1 LIMIT 1`,
        [voiceId],
      );
      return rows.length > 0;
    };

    return generateUniqueVoiceId(exists);
  }

  async seedDefaultRooms(schemaInput: string) {
    const schema = this.normalizeSchema(schemaInput);

    const exists = await this.schemaExists(schema);
    if (!exists) {
      throw new NotFoundException('Tenant schema not found');
    }

    const tenantDataSource = new DataSource({
      ...this.dataSource.options,
      schema,
      entities: this.dataSource.entityMetadatas.map((m) => m.target) as any,
    } as any);

    await tenantDataSource.initialize();

    try {
      const roomRepository = tenantDataSource.getRepository(Room);
      const defaultRooms = await this.buildDefaultRooms(schema);

      let created = 0;
      for (const room of defaultRooms) {
        const existing = await roomRepository.findOne({
          where: { name: room.name },
        });

        if (existing) continue;

        await roomRepository.save(roomRepository.create(room));
        created += 1;
      }

      return {
        schema,
        created,
        skipped: defaultRooms.length - created,
        totalDefaultRooms: defaultRooms.length,
      };
    } finally {
      await tenantDataSource.destroy();
    }
  }

  private buildDefaultRoles(): Array<
    Pick<
      Role,
      | 'name'
      | 'microphoneDuration'
      | 'starColor'
      | 'starCount'
      | 'icon'
      | 'permissions'
    >
  > {
    const baseRole = {
      microphoneDuration: 0,
      permissions: {} as Record<string, boolean>,
    };

    const roles: Array<{
      name: string;
      starCount: number;
      starColor: string;
      icon: string | null;
    }> = [
      { name: 'uye', starCount: 0, starColor: '#FFD700', icon: null },
      { name: 'GOLD', starCount: 1, starColor: '#FFD700', icon: '🅖🅞🅛🅓' },
      { name: 'ADMİN', starCount: 2, starColor: '#FFD700', icon: null },
      { name: 'Co ADMİN', starCount: 3, starColor: '#FFD700', icon: null },
      { name: 'SUPERADMİN', starCount: 4, starColor: '#FFD700', icon: null },
      { name: 'CHAT ADMİN', starCount: 5, starColor: '#FFD700', icon: null },
      { name: 'CHATMASTER', starCount: 6, starColor: '#FFD700', icon: null },
      { name: 'AGENT', starCount: 7, starColor: '#FFD700', icon: null },
      { name: 'SUPERMASTER', starCount: 8, starColor: '#FFD700', icon: null },
      { name: 'SUPERVİSOR', starCount: 9, starColor: '#FFD700', icon: null },
      { name: 'QUEEN', starCount: 10, starColor: '#FFD700', icon: null },
      { name: 'SYSTEMAGENT', starCount: 11, starColor: '#FFD700', icon: null },
      { name: 'KİNGADMİN', starCount: 12, starColor: '#FFD700', icon: null },
      { name: 'RİCHLORD', starCount: 13, starColor: '#FFD700', icon: null },
      { name: 'GHOST', starCount: 14, starColor: '#FFD700', icon: null },
      { name: 'MİSSİONER', starCount: 15, starColor: '#FFD700', icon: null },
      { name: 'PROADMİN', starCount: 16, starColor: '#FFD700', icon: null },
      { name: 'WIPADMIN', starCount: 17, starColor: '#e7041a', icon: 'ᴡɪᴘᴀᴅᴍɪɴ' },
      { name: 'KİNG', starCount: 18, starColor: '#FFD700', icon: 'KING' },
      { name: 'PLATİNYILDIZ', starCount: 19, starColor: '#FFD700', icon: 'ᴄᴇᴏ' },
      { name: 'MEGAYILDIZ', starCount: 20, starColor: '#FFD700', icon: 'ʏᴏɴᴇᴛɪᴍ' },
      { name: 'VİP', starCount: 21, starColor: '#FFD700', icon: 'ѕɪᴛᴇѕᴀʜɪʙɪ' },
      { name: 'STARS', starCount: 22, starColor: '#FFD700', icon: 'ʟɪᴅᴇʀ' },
      { name: 'SYSTEM', starCount: 23, starColor: '#FFD700', icon: '۞ ѕʏѕᴛᴇᴍ ۞' },
      { name: 'KURUCU-CE0', starCount: 24, starColor: '#FFD700', icon: '♖✸ ᴋᴜʀᴜᴄᴜ ✸♖' },
      { name: 'KİNGKONSOL', starCount: 25, starColor: '#f1044b', icon: '♔★ ᴋɪɴɢ ✪ ᴄᴏɴsᴏʟ ★♔' },
      { name: 'KİNGMEGA', starCount: 26, starColor: '#FFD700', icon: '♕❂💎 ᴋɪɴɢᴍᴇɢᴀ 💎❂♕' },
      { name: 'KİNGROOT', starCount: 27, starColor: '#e7041a', icon: '☪✪♛ ᴋɪɴɢʀᴏᴏᴛ ♛✪☪' },
    ];

    return roles.map((role) => ({
      ...baseRole,
      ...role,
      permissions: {},
    }));
  }

  private async buildDefaultRooms(
    schema: string,
  ): Promise<Array<Partial<Room>>> {
    const baseRoom = {
      ownerId: undefined as number | undefined,
      description: 'EdEpLe GeLeN HüRmEtLe GiDeR',
      maxUsers: 200,
      visibleUserCount: 0,
      isPrivate: false,
      password: null,
      radioPanelLink: null,
      minStar: 0,
      backgroundColor: '#0b1220',
      roomImage: null,
      logo: null,
      microphoneLimit: 5,
      isEditable: true,
    };

    const roomConfigs = [
      { name: "lobby", listOrder: 0, microphoneLimit: 5 },
      { name: "Toplantı Odası", listOrder: 1, microphoneLimit: 5 },
      { name: "Sorunlar", listOrder: 2, microphoneLimit: 3 },
      { name: "Başvuru Odası", listOrder: 3, microphoneLimit: 3 },
      { name: "Türkiye", listOrder: 4, microphoneLimit: 5 },
      { name: "İstanbul", listOrder: 5, microphoneLimit: 5 },
      { name: "Ankara", listOrder: 6, microphoneLimit: 5 },
      { name: "İzmir", listOrder: 7, microphoneLimit: 5 },
      { name: "Bursa", listOrder: 8, microphoneLimit: 5 },
      { name: "Antalya", listOrder: 9, microphoneLimit: 5 },
      { name: "Adana", listOrder: 10, microphoneLimit: 5 },
      { name: "Karadeniz", listOrder: 11, microphoneLimit: 5 },
      { name: "Ege", listOrder: 12, microphoneLimit: 5 },
      { name: "Akdeniz", listOrder: 13, microphoneLimit: 5 },
      { name: "Müzik", listOrder: 14, microphoneLimit: 4 },
      { name: "Türkçe Pop", listOrder: 15, microphoneLimit: 4 },
      { name: "Arabesk", listOrder: 16, microphoneLimit: 4 },
      { name: "Nostalji", listOrder: 17, microphoneLimit: 4 },
      { name: "Oyun", listOrder: 18, microphoneLimit: 5 },
      { name: "Futbol", listOrder: 19, microphoneLimit: 5 },
      { name: "Spor", listOrder: 20, microphoneLimit: 5 },
      { name: "Sinema & Dizi", listOrder: 21, microphoneLimit: 4 },
      { name: "Teknoloji", listOrder: 22, microphoneLimit: 4 },
      { name: "Gece Sohbeti", listOrder: 23, microphoneLimit: 5 },
      { name: "Sabah Kahvesi", listOrder: 24, microphoneLimit: 4 },
      { name: "Aşk & Muhabbet", listOrder: 25, microphoneLimit: 4 },
      { name: "Dostluk", listOrder: 26, microphoneLimit: 5 },
      { name: "Yeni Arkadaşlar", listOrder: 27, microphoneLimit: 5 },
      { name: "Gurbetçiler", listOrder: 28, microphoneLimit: 5 },
      { name: "Avrupa", listOrder: 29, microphoneLimit: 5 },
      { name: "Almanya", listOrder: 30, microphoneLimit: 5 },
      { name: "Hollanda", listOrder: 31, microphoneLimit: 5 },
      { name: "Belçika", listOrder: 32, microphoneLimit: 5 },
      { name: "İngiltere", listOrder: 33, microphoneLimit: 5 },
      { name: "Gençlik", listOrder: 34, microphoneLimit: 5 },
      { name: "40+", listOrder: 35, microphoneLimit: 4 },
      { name: "Şiir & Edebiyat", listOrder: 36, microphoneLimit: 3 },
      { name: "Radyo Keyfi", listOrder: 37, microphoneLimit: 4 },
      { name: "Sessiz Oda", listOrder: 38, microphoneLimit: 2 },
    ];

    const rooms: Array<Partial<Room>> = [];

    for (const room of roomConfigs) {
      const voiceId = await this.resolveVoiceIdForSchema(schema);

      rooms.push({
        ...baseRoom,
        ...room,
        voiceId,
      });
    }

    return rooms;
  }
}
