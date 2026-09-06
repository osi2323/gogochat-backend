import { DeleteMessageDto, EditMessageDto, MarkReadDto, MessageQueryDto, ModerateUserDto, SendMessageDto } from './messages.dto';
import { MessagesService } from './messages.service';
export declare class MessagesController {
    private service;
    constructor(service: MessagesService);
    join(roomId: string, r: any): Promise<import("./room-member.entity").RoomMember>;
    members(roomId: string, r: any): Promise<{
        id: string;
        username: string;
        rank: import("../ranks/rank.entity").Rank;
    }[]>;
    messages(roomId: string, r: any, q: MessageQueryDto): Promise<{
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
    send(roomId: string, r: any, d: SendMessageDto): Promise<{
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
    edit(roomId: string, messageId: string, r: any, d: EditMessageDto): Promise<{
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
    remove(roomId: string, messageId: string, r: any, d: DeleteMessageDto): Promise<{
        id: string;
        roomId: string;
        deletedAt: Date;
    }>;
    moderate(roomId: string, r: any, d: ModerateUserDto): Promise<{
        ok: boolean;
        roomId: string;
        targetUserId: string;
        action: "mute" | "unmute" | "kick" | "ban" | "unban";
        forceLeave: boolean;
    }>;
    audit(roomId: string, r: any, limit?: string): Promise<import("./moderation-audit.entity").ModerationAudit[]>;
    read(roomId: string, r: any, d: MarkReadDto): Promise<{
        ok: boolean;
        messageId: string;
    }>;
    unread(roomId: string, r: any): Promise<{
        count: number;
    }>;
}
