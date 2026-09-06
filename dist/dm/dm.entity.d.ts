export declare class DirectConversation {
    id: string;
    pairKey: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class DirectConversationMember {
    conversationId: string;
    userId: string;
    lastReadAt: Date | null;
    lastReadMessageId: string | null;
}
export declare class DirectMessage {
    id: string;
    conversationId: string;
    senderId: string;
    clientId: string;
    body: string;
    mediaAssetId: string | null;
    createdAt: Date;
    editedAt: Date | null;
    deletedAt: Date | null;
}
