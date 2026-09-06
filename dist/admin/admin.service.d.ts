import { Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { Rank } from '../ranks/rank.entity';
import { Room } from '../rooms/room.entity';
import { Message } from '../messages/message.entity';
import { ModerationAudit } from '../messages/moderation-audit.entity';
import { SiteSetting } from './site-setting.entity';
import { WallPost, WallComment } from '../social/wall.entity';
import { SetUserRankDto, UpdateRankDto, UpdateRoomDto, UpdateSettingDto } from './admin.dto';
export declare class AdminService {
    private users;
    private ranks;
    private rooms;
    private messages;
    private audits;
    private settings;
    private wallPosts;
    private wallComments;
    constructor(users: Repository<User>, ranks: Repository<Rank>, rooms: Repository<Room>, messages: Repository<Message>, audits: Repository<ModerationAudit>, settings: Repository<SiteSetting>, wallPosts: Repository<WallPost>, wallComments: Repository<WallComment>);
    private actor;
    private permit;
    overview(id: string): Promise<{
        userCount: number;
        roomCount: number;
        messageCount: number;
        auditCount: number;
        recent: ModerationAudit[];
    }>;
    listUsers(id: string, q?: string): Promise<User[]>;
    setRank(id: string, targetId: string, d: SetUserRankDto): Promise<{
        rank: Rank;
        id: string;
        username: string;
        passwordHash: string | null;
        isGuest: boolean;
        rankId: string;
    }>;
    updateRank(id: string, stars: number, d: UpdateRankDto): Promise<Rank>;
    listRooms(id: string): Promise<Room[]>;
    updateRoom(id: string, roomId: string, d: UpdateRoomDto): Promise<Room>;
    content(id: string, q?: string): Promise<any[]>;
    removeContent(id: string, postId: string, reason?: string): Promise<{
        ok: boolean;
        id: string;
        alreadyDeleted: boolean;
    } | {
        ok: boolean;
        id: string;
        alreadyDeleted?: undefined;
    }>;
    audit(id: string): Promise<ModerationAudit[]>;
    getSettings(id: string): Promise<SiteSetting[]>;
    setSetting(id: string, d: UpdateSettingDto): Promise<SiteSetting>;
}
