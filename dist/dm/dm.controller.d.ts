import { DmService } from './dm.service';
import { SendDmDto } from './dm.dto';
export declare class DmController {
    private s;
    constructor(s: DmService);
    list(r: any): Promise<{
        id: string;
        updatedAt: Date;
        peer: {
            id: string;
            username: string;
            rank: import("../ranks/rank.entity").Rank;
            displayName: string | null;
            avatarUrl: string | null;
        } | null;
        lastMessage: import("./dm.entity").DirectMessage | null;
        unreadCount: number;
    }[]>;
    open(r: any, id: string): Promise<import("./dm.entity").DirectConversation>;
    history(r: any, id: string, before?: string): Promise<{
        items: {
            media: {
                id: any;
                publicUrl: any;
                mimeType: any;
                sizeBytes: any;
            } | null;
            id: string;
            conversationId: string;
            senderId: string;
            clientId: string;
            body: string;
            mediaAssetId: string | null;
            createdAt: Date;
            editedAt: Date | null;
            deletedAt: Date | null;
        }[];
        nextCursor: string | null;
    }>;
    read(r: any, id: string, d: {
        messageId: string;
    }): Promise<{
        messageId: string;
        readAt: Date;
    }>;
    unread(r: any, id: string): Promise<{
        count: number;
    }>;
    send(r: any, id: string, d: SendDmDto): Promise<{
        media: {
            id: any;
            publicUrl: any;
            mimeType: any;
            sizeBytes: any;
        } | null;
        id: string;
        conversationId: string;
        senderId: string;
        clientId: string;
        body: string;
        mediaAssetId: string | null;
        createdAt: Date;
        editedAt: Date | null;
        deletedAt: Date | null;
    }>;
}
