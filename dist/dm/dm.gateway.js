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
exports.DmGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const jwt_1 = require("@nestjs/jwt");
const socket_io_1 = require("socket.io");
const dm_service_1 = require("./dm.service");
const http_security_1 = require("../config/http-security");
let DmGateway = class DmGateway {
    jwt;
    dm;
    server;
    socketsByUser = new Map();
    constructor(jwt, dm) {
        this.jwt = jwt;
        this.dm = dm;
    }
    async handleConnection(c) { try {
        const token = String(c.handshake.auth?.token ?? '');
        const p = await this.jwt.verifyAsync(token);
        c.data.user = { id: String(p.sub), username: String(p.username ?? '') };
        c.data.dmRooms = new Set();
        let set = this.socketsByUser.get(c.data.user.id);
        if (!set)
            this.socketsByUser.set(c.data.user.id, set = new Set());
        set.add(c.id);
    }
    catch {
        c.emit('auth:error', { message: 'Oturum doğrulanamadı' });
        c.disconnect(true);
    } }
    handleDisconnect(c) { const id = c.data.user?.id; if (!id)
        return; const set = this.socketsByUser.get(id); set?.delete(c.id); if (set && !set.size)
        this.socketsByUser.delete(id); }
    async join(c, b, ack) { try {
        const id = String(b.conversationId ?? '');
        await this.dm.assertMember(this.user(c).id, id);
        await c.join(this.key(id));
        c.data.dmRooms?.add(id);
        ack?.({ ok: true });
    }
    catch (e) {
        ack?.({ ok: false, error: this.err(e) });
    } }
    async leave(c, b, ack) { const id = String(b.conversationId ?? ''); await c.leave(this.key(id)); c.data.dmRooms?.delete(id); ack?.({ ok: true }); }
    async send(c, b, ack) { try {
        const id = String(b.conversationId ?? '');
        if (!c.data.dmRooms?.has(id))
            throw new Error('Önce konuşmaya katılmalısın');
        const msg = await this.dm.send(this.user(c).id, id, String(b.clientId ?? ''), b.body, b.mediaAssetId);
        this.server.to(this.key(id)).emit('dm:new', { conversationId: id, message: msg });
        const peers = await this.dm.memberIds(id);
        for (const uid of peers.filter(x => x !== this.user(c).id))
            for (const sid of this.socketsByUser.get(uid) ?? [])
                this.server.to(sid).emit('dm:conversation', { conversationId: id });
        ack?.({ ok: true, data: msg });
    }
    catch (e) {
        ack?.({ ok: false, error: this.err(e) });
    } }
    async read(c, b, ack) { try {
        const id = String(b.conversationId ?? '');
        const data = await this.dm.markRead(this.user(c).id, id, String(b.messageId ?? ''));
        this.server.to(this.key(id)).emit('dm:read', { conversationId: id, userId: this.user(c).id, messageId: data.messageId, readAt: data.readAt });
        ack?.({ ok: true, data });
    }
    catch (e) {
        ack?.({ ok: false, error: this.err(e) });
    } }
    user(c) { if (!c.data.user)
        throw new Error('Oturum doğrulanamadı'); return c.data.user; }
    key(id) { return `dm:${id}`; }
    err(e) { return e instanceof Error ? e.message : 'İşlem başarısız'; }
};
exports.DmGateway = DmGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], DmGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('dm:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], DmGateway.prototype, "join", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('dm:leave'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], DmGateway.prototype, "leave", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('dm:send'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], DmGateway.prototype, "send", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('dm:read'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Function]),
    __metadata("design:returntype", Promise)
], DmGateway.prototype, "read", null);
exports.DmGateway = DmGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/dm', cors: { origin: (0, http_security_1.parseCorsOrigins)(process.env.CORS_ORIGINS ?? 'http://localhost:3000'), credentials: true } }),
    __metadata("design:paramtypes", [jwt_1.JwtService, dm_service_1.DmService])
], DmGateway);
//# sourceMappingURL=dm.gateway.js.map