export declare class Message {
    id: string;
    roomId: string;
    userId: string;
    clientId: string | null;
    body: string;
    mediaAssetId: string | null;
    replyToId: string | null;
    editedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
}
