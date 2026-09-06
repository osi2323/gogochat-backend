import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { PreferencesService } from '../preferences/preferences.service';
type Ack = (payload: {
    ok: true;
    data?: unknown;
} | {
    ok: false;
    error: string;
}) => void;
type AuthedSocket = Socket & {
    data: {
        user?: {
            id: string;
            username: string;
        };
        joinedRooms?: Set<string>;
    };
};
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private jwt;
    private messages;
    private prefs;
    server: Server;
    private readonly presence;
    constructor(jwt: JwtService, messages: MessagesService, prefs: PreferencesService);
    handleConnection(client: AuthedSocket): Promise<void>;
    handleDisconnect(client: AuthedSocket): void;
    join(client: AuthedSocket, body: {
        roomId?: string;
    }, ack?: Ack): Promise<void>;
    leave(client: AuthedSocket, body: {
        roomId?: string;
    }, ack?: Ack): Promise<void>;
    send(client: AuthedSocket, body: {
        roomId?: string;
        body?: string;
        clientId?: string;
        replyToId?: string;
        mediaAssetId?: string;
    }, ack?: Ack): Promise<void>;
    edit(client: AuthedSocket, body: {
        roomId?: string;
        messageId?: string;
        body?: string;
    }, ack?: Ack): Promise<void>;
    remove(client: AuthedSocket, body: {
        roomId?: string;
        messageId?: string;
        reason?: string;
    }, ack?: Ack): Promise<void>;
    moderate(client: AuthedSocket, body: {
        roomId?: string;
        targetUserId?: string;
        action?: 'mute' | 'unmute' | 'kick' | 'ban' | 'unban';
        durationMinutes?: number;
        reason?: string;
    }, ack?: Ack): Promise<void>;
    typing(client: AuthedSocket, body: {
        roomId?: string;
        typing?: boolean;
    }): Promise<void>;
    private forceLeave;
    private user;
    private key;
    private addPresence;
    private visibleOnline;
    private removePresence;
    private online;
    private error;
}
export {};
