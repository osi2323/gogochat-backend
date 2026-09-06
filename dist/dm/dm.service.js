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
exports.DmService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../auth/user.entity");
const profile_entity_1 = require("../profiles/profile.entity");
const dm_entity_1 = require("./dm.entity");
const media_service_1 = require("../media/media.service");
const preferences_service_1 = require("../preferences/preferences.service");
const media_entity_1 = require("../media/media.entity");
const notifications_service_1 = require("../notifications/notifications.service");
let DmService = class DmService {
    users;
    convs;
    members;
    messages;
    db;
    media;
    prefs;
    notifications;
    constructor(users, convs, members, messages, db, media, prefs, notifications) {
        this.users = users;
        this.convs = convs;
        this.members = members;
        this.messages = messages;
        this.db = db;
        this.media = media;
        this.prefs = prefs;
        this.notifications = notifications;
    }
    pair(a, b) { return [a, b].sort().join(':'); }
    async open(actorId, otherId) { if (actorId === otherId)
        throw new common_1.BadRequestException('Kendine mesaj gönderemezsin'); if (!await this.users.existsBy({ id: otherId }))
        throw new common_1.NotFoundException(); if (!await this.prefs.canReceiveDm(otherId))
        throw new common_1.ForbiddenException('Bu kullanıcı özel mesajları kapatmış.'); return this.db.transaction(async (m) => { const pairKey = this.pair(actorId, otherId); await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`dm:${pairKey}`]); const repo = m.getRepository(dm_entity_1.DirectConversation); let c = await repo.findOneBy({ pairKey }); if (!c) {
        c = await repo.save(repo.create({ pairKey }));
        await m.createQueryBuilder().insert().into(dm_entity_1.DirectConversationMember).values([{ conversationId: c.id, userId: actorId, lastReadAt: null, lastReadMessageId: null }, { conversationId: c.id, userId: otherId, lastReadAt: null, lastReadMessageId: null }]).orIgnore().execute();
    } return c; }); }
    async assertMember(userId, id) { if (!await this.members.existsBy({ conversationId: id, userId }))
        throw new common_1.ForbiddenException('Bu konuşmaya erişemezsin'); }
    async memberIds(id) { return (await this.members.findBy({ conversationId: id })).map(x => x.userId); }
    async list(actorId) { const mine = await this.members.findBy({ userId: actorId }); if (!mine.length)
        return []; const ids = mine.map(x => x.conversationId), rows = await this.convs.find({ where: { id: (0, typeorm_2.In)(ids) }, order: { updatedAt: 'DESC' } }); return Promise.all(rows.map(async (c) => { const membership = mine.find(x => x.conversationId === c.id); const peerMember = await this.members.createQueryBuilder('m').where('m.conversationId=:c AND m.userId<>:u', { c: c.id, u: actorId }).getOne(); const peer = peerMember ? await this.users.findOne({ where: { id: peerMember.userId }, relations: { rank: true } }) : null; const profile = peer ? await this.db.getRepository(profile_entity_1.Profile).findOneBy({ userId: peer.id }) : null; const last = await this.messages.findOne({ where: { conversationId: c.id }, order: { createdAt: 'DESC' } }); const unread = await this.unreadCount(actorId, c.id); return { id: c.id, updatedAt: c.updatedAt, peer: peer ? { id: peer.id, username: peer.username, rank: peer.rank, displayName: profile?.displayName ?? null, avatarUrl: profile?.avatarUrl ?? null } : null, lastMessage: last, unreadCount: unread }; })); }
    async history(actorId, id, before) { await this.assertMember(actorId, id); const q = this.messages.createQueryBuilder('m').where('m.conversationId=:id AND m.deletedAt IS NULL', { id }).orderBy('m.createdAt', 'DESC').addOrderBy('m.id', 'DESC').take(50); if (before) {
        const cursor = await this.messages.findOneBy({ id: before, conversationId: id });
        if (cursor)
            q.andWhere('(m.createdAt < :at OR (m.createdAt = :at AND m.id < :mid))', { at: cursor.createdAt, mid: cursor.id });
    } const rows = await q.getMany(); rows.reverse(); return { items: await Promise.all(rows.map(x => this.hydrate(x))), nextCursor: rows.length === 50 ? rows[0].id : null }; }
    async send(actorId, id, clientId, body, mediaAssetId) { await this.assertMember(actorId, id); const peer = (await this.memberIds(id)).find(x => x !== actorId); if (peer && !await this.prefs.canReceiveDm(peer))
        throw new common_1.ForbiddenException('Bu kullanıcı özel mesajları kapatmış.'); const clean = (body ?? '').trim(); if (!clean && !mediaAssetId)
        throw new common_1.BadRequestException('Mesaj veya medya gerekli'); const prior = await this.messages.findOneBy({ senderId: actorId, clientId }); if (prior)
        return this.hydrate(prior); return this.db.transaction(async (m) => { const msg = await m.getRepository(dm_entity_1.DirectMessage).save(m.getRepository(dm_entity_1.DirectMessage).create({ conversationId: id, senderId: actorId, clientId, body: clean, mediaAssetId: mediaAssetId ?? null })); if (mediaAssetId)
        await this.media.claim(m, actorId, mediaAssetId, 'dm', 'direct_message', msg.id); await m.getRepository(dm_entity_1.DirectConversation).update(id, { updatedAt: new Date() }); const hydrated = await this.hydrate(msg, m); if (peer)
        await this.notifications.create(peer, 'dm.message', actorId, { conversationId: id, messageId: msg.id }); return hydrated; }); }
    async markRead(actorId, id, messageId) { await this.assertMember(actorId, id); const msg = await this.messages.findOneBy({ id: messageId, conversationId: id }); if (!msg)
        throw new common_1.NotFoundException('Mesaj bulunamadı'); const readAt = new Date(); await this.members.update({ conversationId: id, userId: actorId }, { lastReadAt: readAt, lastReadMessageId: messageId }); return { messageId, readAt }; }
    async unreadCount(actorId, id) { const m = await this.members.findOneBy({ conversationId: id, userId: actorId }); if (!m)
        throw new common_1.ForbiddenException(); const q = this.messages.createQueryBuilder('x').where('x.conversationId=:id AND x.senderId<>:u AND x.deletedAt IS NULL', { id, u: actorId }); if (m.lastReadAt)
        q.andWhere('x.createdAt > :at', { at: m.lastReadAt }); return q.getCount(); }
    async hydrate(msg, manager) { if (!msg.mediaAssetId)
        return { ...msg, media: null }; const repo = manager ? manager.getRepository(media_entity_1.MediaAsset) : this.db.getRepository(media_entity_1.MediaAsset); const a = await repo.findOneBy({ id: msg.mediaAssetId }); return { ...msg, media: a && !a.deletedAt ? { id: a.id, publicUrl: a.publicUrl, mimeType: a.mimeType, sizeBytes: a.sizeBytes } : null }; }
};
exports.DmService = DmService;
exports.DmService = DmService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(dm_entity_1.DirectConversation)),
    __param(2, (0, typeorm_1.InjectRepository)(dm_entity_1.DirectConversationMember)),
    __param(3, (0, typeorm_1.InjectRepository)(dm_entity_1.DirectMessage)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.DataSource, media_service_1.MediaService, preferences_service_1.PreferencesService, notifications_service_1.NotificationsService])
], DmService);
//# sourceMappingURL=dm.service.js.map