import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private n;
    constructor(n: NotificationsService);
    list(r: any, b?: string): Promise<{
        items: import("./notification.entity").Notification[];
        nextCursor: string | null;
        unreadCount: number;
    }>;
    count(r: any): Promise<{
        count: number;
    }>;
    all(r: any): Promise<{
        ok: boolean;
    }>;
    read(r: any, id: string): Promise<{
        ok: boolean;
        readAt: Date;
    }>;
}
