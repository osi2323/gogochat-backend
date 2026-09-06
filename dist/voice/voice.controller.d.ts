import { VoiceService } from './voice.service';
declare class VoiceRemoveDto {
    targetUserId: string;
    reason?: string;
}
export declare class VoiceController {
    private voice;
    constructor(voice: VoiceService);
    token(roomId: string, req: any): Promise<{
        url: string;
        token: string;
        sessionId: string;
        expiresAt: string;
        remainingSeconds: number;
        maxMicrophones: number;
    }>;
    leave(roomId: string, req: any): Promise<{
        ok: boolean;
    }>;
    status(roomId: string, req: any): Promise<{
        active: boolean;
        remainingSeconds: number;
        expiresAt: null;
        activeCount: number;
        maxMicrophones: number;
    } | {
        active: boolean;
        remainingSeconds: number;
        expiresAt: string;
        activeCount: number;
        maxMicrophones: number;
    }>;
    participants(roomId: string, req: any): Promise<{
        sessionId: string;
        userId: string;
        username: string;
        starCount: number;
        rankName: string;
        startedAt: Date;
        expiresAt: Date;
    }[]>;
    remove(roomId: string, req: any, body: VoiceRemoveDto): Promise<{
        ok: boolean;
        userId: string;
    }>;
}
export {};
