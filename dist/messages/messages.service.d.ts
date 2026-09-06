import { DataSource, Repository } from 'typeorm';
import { Room } from '../rooms/room.entity';
import { RoomMember } from './room-member.entity';
import { Message } from './message.entity';
import { RoomRead } from './room-read.entity';
import { ModerationAudit } from './moderation-audit.entity';
import { RoomBan } from './room-ban.entity';
import { User } from '../auth/user.entity';
import { MediaService } from '../media/media.service';
export declare class MessagesService {
    private rooms;
    private members;
    private messages;
    private reads;
    private users;
    private audits;
    private bans;
    private db;
    private media;
    constructor(rooms: Repository<Room>, members: Repository<RoomMember>, messages: Repository<Message>, reads: Repository<RoomRead>, users: Repository<User>, audits: Repository<ModerationAudit>, bans: Repository<RoomBan>, db: DataSource, media: MediaService);
    join(roomId: string, userId: string): Promise<RoomMember>;
    listMembers(roomId: string, userId: string): Promise<{
        id: string;
        username: string;
        rank: import("../ranks/rank.entity").Rank;
    }[]>;
    history(roomId: string, userId: string, limit?: number, before?: string): Promise<{
        items: {
            id: string;
            clientId: string | null;
            body: string;
            media: {
                id: string;
                publicUrl: string;
                mimeType: string;
                sizeBytes: number;
            } | null;
            replyToId: string | null;
            editedAt: Date | null;
            deletedAt: Date | null;
            createdAt: Date;
            user: {
                id: string;
                username: string;
                rank: import("../ranks/rank.entity").Rank | null;
            };
        }[];
        hasMore: boolean;
        nextCursor: string | null;
    }>;
    send(roomId: string, userId: string, body: string | undefined, clientId: string, replyToId?: string, mediaAssetId?: string): Promise<{
        id: string;
        clientId: string | null;
        body: string;
        media: {
            id: string;
            publicUrl: string;
            mimeType: string;
            sizeBytes: number;
        } | null;
        replyToId: string | null;
        editedAt: Date | null;
        deletedAt: Date | null;
        createdAt: Date;
        user: {
            id: string;
            username: string;
            rank: import("../ranks/rank.entity").Rank | null;
        };
    }>;
    edit(roomId: string, userId: string, messageId: string, body: string): Promise<{
        id: string;
        clientId: string | null;
        body: string;
        media: {
            id: string;
            publicUrl: string;
            mimeType: string;
            sizeBytes: number;
        } | null;
        replyToId: string | null;
        editedAt: Date | null;
        deletedAt: Date | null;
        createdAt: Date;
        user: {
            id: string;
            username: string;
            rank: import("../ranks/rank.entity").Rank | null;
        };
    }>;
    remove(roomId: string, actorId: string, messageId: string, reason?: string): Promise<{
        id: string;
        roomId: string;
        deletedAt: Date;
    }>;
    audit(roomId: string, userId: string, limit?: number): Promise<ModerationAudit[]>;
    markRead(roomId: string, userId: string, messageId: string): Promise<{
        ok: boolean;
        messageId: string;
    }>;
    unread(roomId: string, userId: string): Promise<{
        count: number;
    }>;
    assertMember(roomId: string, userId: string): Promise<RoomMember>;
    private hydrate;
    moderate(roomId: string, actorId: string, targetUserId: string, action: 'mute' | 'unmute' | 'kick' | 'ban' | 'unban', durationMinutes?: number, reason?: string): Promise<{
        ok: boolean;
        roomId: string;
        targetUserId: string;
        action: "mute" | "unmute" | "kick" | "ban" | "unban";
        forceLeave: boolean;
    }>;
    private requireMember;
}
