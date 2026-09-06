import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { PreferencesService } from '../preferences/preferences.service';
export declare class NotificationsService {
    private repo;
    private prefs;
    constructor(repo: Repository<Notification>, prefs: PreferencesService);
    create(userId: string, type: string, actorId: string | null, data?: Record<string, unknown>): Promise<Notification | null>;
    list(userId: string, before?: string): Promise<{
        items: Notification[];
        nextCursor: string | null;
        unreadCount: number;
    }>;
    unreadCount(userId: string): Promise<number>;
    read(userId: string, id: string): Promise<{
        ok: boolean;
        readAt: Date;
    }>;
    readAll(userId: string): Promise<{
        ok: boolean;
    }>;
}
