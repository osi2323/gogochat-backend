import { AdminService } from './admin.service';
import { SetUserRankDto, UpdateRankDto, UpdateRoomDto, UpdateSettingDto } from './admin.dto';
export declare class AdminController {
    private a;
    constructor(a: AdminService);
    overview(r: any): Promise<{
        userCount: number;
        roomCount: number;
        messageCount: number;
        auditCount: number;
        recent: import("../messages/moderation-audit.entity").ModerationAudit[];
    }>;
    users(r: any, q?: string): Promise<import("../auth/user.entity").User[]>;
    rankUser(r: any, id: string, d: SetUserRankDto): Promise<{
        rank: import("../ranks/rank.entity").Rank;
        id: string;
        username: string;
        passwordHash: string | null;
        isGuest: boolean;
        rankId: string;
    }>;
    rank(r: any, s: number, d: UpdateRankDto): Promise<import("../ranks/rank.entity").Rank>;
    rooms(r: any): Promise<import("../rooms/room.entity").Room[]>;
    room(r: any, id: string, d: UpdateRoomDto): Promise<import("../rooms/room.entity").Room>;
    content(r: any, q?: string): Promise<any[]>;
    removeContent(r: any, id: string, d: {
        reason?: string;
    }): Promise<{
        ok: boolean;
        id: string;
        alreadyDeleted: boolean;
    } | {
        ok: boolean;
        id: string;
        alreadyDeleted?: undefined;
    }>;
    audit(r: any): Promise<import("../messages/moderation-audit.entity").ModerationAudit[]>;
    settings(r: any): Promise<import("./site-setting.entity").SiteSetting[]>;
    setting(r: any, d: UpdateSettingDto): Promise<import("./site-setting.entity").SiteSetting>;
}
