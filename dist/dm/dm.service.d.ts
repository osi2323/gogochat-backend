import { DataSource, Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { DirectConversation, DirectConversationMember, DirectMessage } from './dm.entity';
import { MediaService } from '../media/media.service';
import { PreferencesService } from '../preferences/preferences.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class DmService {
    private users;
    private convs;
    private members;
    private messages;
    private db;
    private media;
    private prefs;
    private notifications;
    constructor(users: Repository<User>, convs: Repository<DirectConversation>, members: Repository<DirectConversationMember>, messages: Repository<DirectMessage>, db: DataSource, media: MediaService, prefs: PreferencesService, notifications: NotificationsService);
    private pair;
    open(actorId: string, otherId: string): Promise<DirectConversation>;
    assertMember(userId: string, id: string): Promise<void>;
    memberIds(id: string): Promise<string[]>;
    list(actorId: string): Promise<{
        id: string;
        updatedAt: Date;
        peer: {
            id: string;
            username: string;
            rank: import("../ranks/rank.entity").Rank;
            displayName: string | null;
            avatarUrl: string | null;
        } | null;
        lastMessage: DirectMessage | null;
        unreadCount: number;
    }[]>;
    history(actorId: string, id: string, before?: string): Promise<{
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
    send(actorId: string, id: string, clientId: string, body: string | undefined, mediaAssetId?: string): Promise<{
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
    markRead(actorId: string, id: string, messageId: string): Promise<{
        messageId: string;
        readAt: Date;
    }>;
    unreadCount(actorId: string, id: string): Promise<number>;
    private hydrate;
}
