export declare class Notification {
    id: string;
    userId: string;
    actorId: string | null;
    type: string;
    data: Record<string, unknown>;
    readAt: Date | null;
    createdAt: Date;
}
