"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const jwt_1 = require("@nestjs/jwt");
const socket_io_1 = require("socket.io");
const messages_service_1 = require("./messages.service");
const preferences_service_1 = require("../preferences/preferences.service");
const http_security_1 = require("../config/http-security");
let ChatGateway = class ChatGateway {
    jwt;
    messages;
    prefs;
    server;
    presence = new Map();
    constructor(jwt, messages, prefs) {
        this.jwt = jwt;
        this.messages = messages;
        this.prefs = prefs;
    }
    async handleConnection(client) {
        try {
            const raw = String(client.handshake.auth?.token ?? '');
            if (!raw)
                throw new Error();
            const p = await this.jwt.verifyAsync(raw);
            client.data.user = { id: String(p.sub), username: String(p.username ?? '') };
            client.data.joinedRooms = new Set();
        }
        catch {
            client.emit('auth:error', { message: 'Oturum doğrulanamadı' });
            client.disconnect(true);
        }
    }
    handleDisconnect(client) { for (const roomId of client.data.joinedRooms ?? [])
        this.removePresence(roomId, client); }
    async join(client, body, ack) {
        try {
            const user = this.user(client), roomId = String(body?.roomId ?? '');
            await this.messages.assertMember(roomId, user.id);
            await client.join(this.key(roomId));
            client.data.joinedRooms?.add(roomId);
            this.addPresence(roomId, client);
            const onlineUserIds = await this.visibleOnline(roomId);
            this.server.to(this.key(roomId)).emit('presence:changed', { roomId, userId: user.id, online: true, onlineUserIds });
            ack?.({ ok: true, data: { onlineUserIds } });
        }
        catch (e) {
            ack?.({ ok: false, error: this.error(e) });
        }
    }
    async leave(client, body, ack) {
        try {
            const roomId = String(body?.roomId ?? '');
            await client.leave(this.key(roomId));
            client.data.joinedRooms?.delete(roomId);
            this.removePresence(roomId, client);
            ack?.({ ok: true });
        }
        catch (e) {
            ack?.({ ok: false, error: this.error(e) });
        }
    }
    async send(client, body, ack) {
        try {
            const user = this.user(client), roomId = String(body?.roomId ?? '');
            if (!client.data.joinedRooms?.has(roomId))
                throw new Error('Önce realtime odaya katılmalısın');
            const message = await this.messages.send(roomId, user.id, String(body?.body ?? ''), String(body?.clientId ?? ''), body?.replyToId, body?.mediaAssetId);
            this.server.to(this.key(roomId)).emit('message:new', { roomId, message });
            ack?.({ ok: true, data: message });
        }
        catch (e) {
            ack?.({ ok: false, error: this.error(e) });
        }
    }
    async edit(client, body, ack) { try {
        const u = this.user(client), roomId = String(body.roomId ?? '');
        if (!client.data.joinedRooms?.has(roomId))
            throw new Error('Önce realtime odaya katılmalısın');
        const message = await this.messages.edit(roomId, u.id, String(body.messageId ?? ''), String(body.body ?? ''));
        this.server.to(this.key(roomId)).emit('message:updated', { roomId, message });
        ack?.({ ok: true, data: message });
    }
    catch (e) {
        ack?.({ ok: false, error: this.error(e) });
    } }
    async remove(client, body, ack) { try {
        const u = this.user(client), roomId = String(body.roomId ?? '');
        if (!client.data.joinedRooms?.has(roomId))
            throw new Error('Önce realtime odaya katılmalısın');
        const result = await this.messages.remove(roomId, u.id, String(body.messageId ?? ''), body.reason);
        this.server.to(this.key(roomId)).emit('message:deleted', { ...result, roomId });
        ack?.({ ok: true, data: result });
    }
    catch (e) {
        ack?.({ ok: false, error: this.error(e) });
    } }
    async moderate(client, body, ack) { try {
        const u = this.user(client), roomId = String(body.roomId ?? ''), targetUserId = String(body.targetUserId ?? ''), action = body.action;
        if (!action)
            throw new Error('Moderasyon işlemi eksik');
        if (!client.data.joinedRooms?.has(roomId))
            throw new Error('Önce realtime odaya katılmalısın');
        const result = await this.messages.moderate(roomId, u.id, targetUserId, action, body.durationMinutes, body.reason);
        this.server.to(this.key(roomId)).emit('moderation:changed', result);
        if (result.forceLeave)
            await this.forceLeave(roomId, targetUserId, action);
        ack?.({ ok: true, data: result });
    }
    catch (e) {
        ack?.({ ok: false, error: this.error(e) });
    } }
    async typing(client, body) {
        const user = this.user(client), roomId = String(body?.roomId ?? '');
        if (!client.data.joinedRooms?.has(roomId))
            return;
        client.to(this.key(roomId)).emit('typing:changed', { roomId, userId: user.id, username: user.username, typing: body?.typing === true });
    }
    async forceLeave(roomId, userId, action) { const sockets = await this.server.in(this.key(roomId)).fetchSockets(); for (const remote of sockets) {
        const s = remote;
        if (s.data.user?.id !== userId)
            continue;
        await s.leave(this.key(roomId));
        s.data.joinedRooms?.delete(roomId);
        this.removePresence(roomId, s);
        s.emit('room:removed', { roomId, action });
    } }
    user(client) { if (!client.data.user)
        throw new Error('Oturum doğrulanamadı'); return client.data.user; }
    key(roomId) { return `room:${roomId}`; }
    addPresence(roomId, client) { const user = this.user(client); let users = this.presence.get(roomId); if (!users)
        this.presence.set(roomId, users = new Map()); let sockets = users.get(user.id); if (!sockets)
        users.set(user.id, sockets = new Set()); sockets.add(client.id); }
    async visibleOnline(roomId) { return this.prefs.visibleOnlineUserIds(this.online(roomId)); }
    removePresence(roomId, client) { const user = client.data.user; if (!user)
        return; const users = this.presence.get(roomId), sockets = users?.get(user.id); if (!users || !sockets)
        return; sockets.delete(client.id); if (!sockets.size) {
        users.delete(user.id);
        void this.visibleOnline(roomId).then(onlineUserIds => this.server.to(this.key(roomId)).emit('presence:changed', { roomId, userId: user.id, online: false, onlineUserIds }));
    } if (!users.size)
        this.presence.delete(roomId); }
    online(roomId) { return [...(this.presence.get(roomId)?.keys() ?? [])]; }
    error(e) { return e instanceof Error ? e.message : 'İşlem başarısız'; }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "join", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:leave'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "leave", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:send'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "send", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:edit'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "edit", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:delete'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "remove", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:moderate'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "moderate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing:set'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "typing", null);
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/chat', cors: { origin: (0, http_security_1.parseCorsOrigins)(process.env.CORS_ORIGINS ?? 'http://localhost:3000'), credentials: true } }),
    __metadata("design:paramtypes", [jwt_1.JwtService, messages_service_1.MessagesService, preferences_service_1.PreferencesService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map