export declare class ModerationAudit {
    id: string;
    actorId: string;
    targetUserId: string | null;
    roomId: string | null;
    messageId: string | null;
    action: string;
    reason: string | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
}
