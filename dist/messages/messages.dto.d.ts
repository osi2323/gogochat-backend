export declare class JoinRoomDto {
}
export declare class SendMessageDto {
    body?: string;
    clientId: string;
    replyToId?: string;
    mediaAssetId?: string;
}
export declare class MessageQueryDto {
    before?: string;
    limit: number;
}
export declare class MarkReadDto {
    messageId: string;
}
export declare class EditMessageDto {
    body: string;
}
export declare class DeleteMessageDto {
    reason?: string;
}
export declare class ModerateUserDto {
    targetUserId: string;
    action: 'mute' | 'unmute' | 'kick' | 'ban' | 'unban';
    durationMinutes?: number;
    reason?: string;
}
