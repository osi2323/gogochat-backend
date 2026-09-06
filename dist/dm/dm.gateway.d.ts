import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { DmService } from './dm.service';
type Ack = (p: {
    ok: true;
    data?: unknown;
} | {
    ok: false;
    error: string;
}) => void;
type S = Socket & {
    data: {
        user?: {
            id: string;
            username: string;
        };
        dmRooms?: Set<string>;
    };
};
export declare class DmGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private jwt;
    private dm;
    server: Server;
    private socketsByUser;
    constructor(jwt: JwtService, dm: DmService);
    handleConnection(c: S): Promise<void>;
    handleDisconnect(c: S): void;
    join(c: S, b: {
        conversationId?: string;
    }, ack?: Ack): Promise<void>;
    leave(c: S, b: {
        conversationId?: string;
    }, ack?: Ack): Promise<void>;
    send(c: S, b: {
        conversationId?: string;
        clientId?: string;
        body?: string;
        mediaAssetId?: string;
    }, ack?: Ack): Promise<void>;
    read(c: S, b: {
        conversationId?: string;
        messageId?: string;
    }, ack?: Ack): Promise<void>;
    private user;
    private key;
    private err;
}
export {};
