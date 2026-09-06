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
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const room_entity_1 = require("../rooms/room.entity");
const room_member_entity_1 = require("./room-member.entity");
const message_entity_1 = require("./message.entity");
const room_read_entity_1 = require("./room-read.entity");
const moderation_audit_entity_1 = require("./moderation-audit.entity");
const room_ban_entity_1 = require("./room-ban.entity");
const user_entity_1 = require("../auth/user.entity");
const rank_policy_1 = require("../common/rank-policy");
const media_service_1 = require("../media/media.service");
const media_entity_1 = require("../media/media.entity");
let MessagesService = class MessagesService {
    rooms;
    members;
    messages;
    reads;
    users;
    audits;
    bans;
    db;
    media;
    constructor(rooms, members, messages, reads, users, audits, bans, db, media) {
        this.rooms = rooms;
        this.members = members;
        this.messages = messages;
        this.reads = reads;
        this.users = users;
        this.audits = audits;
        this.bans = bans;
        this.db = db;
        this.media = media;
    }
    async join(roomId, userId) { return this.db.transaction(async (em) => { const room = await em.findOne(room_entity_1.Room, { where: { id: roomId }, lock: { mode: 'pessimistic_write' } }); if (!room)
        throw new common_1.NotFoundException('Oda bulunamadı'); const ban = await em.findOneBy(room_ban_entity_1.RoomBan, { roomId, userId }); if (ban && (!ban.expiresAt || ban.expiresAt > new Date()))
        throw new common_1.ForbiddenException('Bu odadan yasaklandın'); if (ban?.expiresAt && ban.expiresAt <= new Date())
        await em.remove(room_ban_entity_1.RoomBan, ban); if (room.isLocked)
        throw new common_1.ForbiddenException('Oda kilitli'); const existing = await em.findOneBy(room_member_entity_1.RoomMember, { roomId, userId }); if (existing)
        return existing; const count = await em.count(room_member_entity_1.RoomMember, { where: { roomId } }); if (count >= room.maxMembers)
        throw new common_1.BadRequestException('Oda dolu'); return em.save(room_member_entity_1.RoomMember, em.create(room_member_entity_1.RoomMember, { roomId, userId })); }); }
    async listMembers(roomId, userId) { await this.requireMember(roomId, userId); const rows = await this.members.find({ where: { roomId }, order: { joinedAt: 'ASC' } }); const ids = rows.map(x => x.userId); if (!ids.length)
        return []; const users = await this.users.createQueryBuilder('u').leftJoinAndSelect('u.rank', 'rank').where('u.id IN (:...ids)', { ids }).getMany(); return users.map(u => ({ id: u.id, username: u.username, rank: u.rank })); }
    async history(roomId, userId, limit = 50, before) { await this.requireMember(roomId, userId); let anchor; if (before) {
        anchor = await this.messages.findOneBy({ id: before, roomId }) ?? undefined;
        if (!anchor)
            throw new common_1.BadRequestException('Geçersiz mesaj cursor');
    } const take = Math.min(limit, 100); const qb = this.messages.createQueryBuilder('m').where('m.room_id=:roomId', { roomId }).orderBy('m.created_at', 'DESC').addOrderBy('m.id', 'DESC').take(take + 1); if (anchor)
        qb.andWhere('(m.created_at < :created OR (m.created_at = :created AND m.id < :id))', { created: anchor.createdAt, id: anchor.id }); const raw = await qb.getMany(); const hasMore = raw.length > take; const items = raw.slice(0, take).reverse(); return { items: await this.hydrate(items), hasMore, nextCursor: hasMore ? items[0]?.id ?? null : null }; }
    async send(roomId, userId, body, clientId, replyToId, mediaAssetId) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId))
        throw new common_1.BadRequestException('Geçersiz clientId'); const membership = await this.requireMember(roomId, userId); if (membership.mutedUntil && membership.mutedUntil > new Date())
        throw new common_1.ForbiddenException(`Susturma ${membership.mutedUntil.toISOString()} tarihine kadar aktif`); const clean = (body ?? '').trim(); if (!clean && !mediaAssetId)
        throw new common_1.BadRequestException('Mesaj veya medya gerekli'); let reply = null; if (replyToId) {
        reply = await this.messages.findOneBy({ id: replyToId, roomId });
        if (!reply || reply.deletedAt)
            throw new common_1.BadRequestException('Yanıtlanan mesaj bulunamadı');
    } const existing = await this.messages.findOneBy({ userId, clientId }); if (existing) {
        if (existing.roomId !== roomId)
            throw new common_1.BadRequestException('clientId başka odada kullanılmış');
        return (await this.hydrate([existing]))[0];
    } try {
        return await this.db.transaction(async (em) => { const saved = await em.getRepository(message_entity_1.Message).save(em.getRepository(message_entity_1.Message).create({ roomId, userId, body: clean, clientId, replyToId: reply?.id ?? null, mediaAssetId: mediaAssetId ?? null })); if (mediaAssetId)
            await this.media.claim(em, userId, mediaAssetId, 'room', 'room_message', saved.id); return (await this.hydrate([saved]))[0]; });
    }
    catch (e) {
        if (String(e?.code) === '23505') {
            const retry = await this.messages.findOneBy({ userId, clientId });
            if (retry && retry.roomId === roomId)
                return (await this.hydrate([retry]))[0];
        }
        throw e;
    } }
    async edit(roomId, userId, messageId, body) { await this.requireMember(roomId, userId); const m = await this.messages.findOneBy({ id: messageId, roomId }); if (!m || m.deletedAt)
        throw new common_1.NotFoundException('Mesaj bulunamadı'); if (m.userId !== userId)
        throw new common_1.ForbiddenException('Yalnızca kendi mesajını düzenleyebilirsin'); const clean = body.trim(); if (!clean)
        throw new common_1.BadRequestException('Boş mesaj kaydedilemez'); m.body = clean; m.editedAt = new Date(); return (await this.hydrate([await this.messages.save(m)]))[0]; }
    async remove(roomId, actorId, messageId, reason) { await this.requireMember(roomId, actorId); return this.db.transaction(async (em) => { const m = await em.findOne(message_entity_1.Message, { where: { id: messageId, roomId }, lock: { mode: 'pessimistic_write' } }); if (!m || m.deletedAt)
        throw new common_1.NotFoundException('Mesaj bulunamadı'); if (m.userId !== actorId) {
        const [actor, target] = await Promise.all([em.findOne(user_entity_1.User, { where: { id: actorId }, relations: { rank: true } }), em.findOne(user_entity_1.User, { where: { id: m.userId }, relations: { rank: true } })]);
        if (!actor || !target)
            throw new common_1.NotFoundException('Kullanıcı bulunamadı');
        (0, rank_policy_1.assertCanAct)(actor, target, 'room.moderateMessages');
        await em.save(moderation_audit_entity_1.ModerationAudit, em.create(moderation_audit_entity_1.ModerationAudit, { actorId, targetUserId: target.id, roomId, messageId: m.id, action: 'message.delete', reason: reason?.trim() || null, metadata: { targetStars: target.rank.starCount } }));
    } m.deletedAt = new Date(); m.body = ''; return { id: (await em.save(message_entity_1.Message, m)).id, roomId, deletedAt: m.deletedAt }; }); }
    async audit(roomId, userId, limit = 50) { await this.requireMember(roomId, userId); const actor = await this.users.findOne({ where: { id: userId }, relations: { rank: true } }); if (!actor?.rank?.permissions?.['room.audit'])
        throw new common_1.ForbiddenException('Denetim kayıtlarını görme yetkin yok'); return this.audits.find({ where: { roomId }, order: { createdAt: 'DESC' }, take: Math.min(Math.max(limit, 1), 100) }); }
    async markRead(roomId, userId, messageId) { await this.requireMember(roomId, userId); const message = await this.messages.findOneBy({ id: messageId, roomId }); if (!message)
        throw new common_1.BadRequestException('Mesaj bu odaya ait değil'); await this.reads.upsert({ roomId, userId, lastReadMessageId: messageId, lastReadAt: new Date() }, ['roomId', 'userId']); return { ok: true, messageId }; }
    async unread(roomId, userId) { await this.requireMember(roomId, userId); const read = await this.reads.findOneBy({ roomId, userId }); if (!read?.lastReadMessageId)
        return { count: await this.messages.count({ where: { roomId } }) }; const anchor = await this.messages.findOneBy({ id: read.lastReadMessageId, roomId }); if (!anchor)
        return { count: await this.messages.count({ where: { roomId } }) }; const count = await this.messages.createQueryBuilder('m').where('m.room_id=:roomId', { roomId }).andWhere('(m.created_at > :created OR (m.created_at = :created AND m.id > :id))', { created: anchor.createdAt, id: anchor.id }).getCount(); return { count }; }
    async assertMember(roomId, userId) { return this.requireMember(roomId, userId); }
    async hydrate(items) { const ids = [...new Set(items.map(x => x.userId))]; const users = ids.length ? await this.users.createQueryBuilder('u').leftJoinAndSelect('u.rank', 'rank').where('u.id IN (:...ids)', { ids }).getMany() : []; const map = new Map(users.map(u => [u.id, u])); const mediaIds = items.map(x => x.mediaAssetId).filter((x) => !!x); const media = mediaIds.length ? await this.db.getRepository(media_entity_1.MediaAsset).createQueryBuilder('a').where('a.id IN (:...ids) AND a.deleted_at IS NULL', { ids: mediaIds }).getMany() : []; const mediaMap = new Map(media.map(a => [a.id, a])); return items.map(m => ({ id: m.id, clientId: m.clientId, body: m.deletedAt ? '' : m.body, media: m.deletedAt || !m.mediaAssetId ? null : (() => { const a = mediaMap.get(m.mediaAssetId); return a ? { id: a.id, publicUrl: a.publicUrl, mimeType: a.mimeType, sizeBytes: a.sizeBytes } : null; })(), replyToId: m.replyToId, editedAt: m.editedAt, deletedAt: m.deletedAt, createdAt: m.createdAt, user: { id: m.userId, username: map.get(m.userId)?.username ?? 'Kullanıcı', rank: map.get(m.userId)?.rank ?? null } })); }
    async moderate(roomId, actorId, targetUserId, action, durationMinutes, reason) {
        await this.requireMember(roomId, actorId);
        return this.db.transaction(async (em) => {
            const [actor, target] = await Promise.all([em.findOne(user_entity_1.User, { where: { id: actorId }, relations: { rank: true } }), em.findOne(user_entity_1.User, { where: { id: targetUserId }, relations: { rank: true } })]);
            if (!actor || !target)
                throw new common_1.NotFoundException('Kullanıcı bulunamadı');
            const permission = action === 'mute' || action === 'unmute' ? 'room.mute' : action === 'kick' ? 'room.kick' : 'room.ban';
            (0, rank_policy_1.assertCanAct)(actor, target, permission);
            const member = await em.findOne(room_member_entity_1.RoomMember, { where: { roomId, userId: targetUserId }, lock: { mode: 'pessimistic_write' } });
            const existingBan = await em.findOne(room_ban_entity_1.RoomBan, { where: { roomId, userId: targetUserId }, lock: { mode: 'pessimistic_write' } });
            if (action === 'mute') {
                if (!member)
                    throw new common_1.NotFoundException('Hedef kullanıcı odada değil');
                const mins = Math.min(Math.max(durationMinutes ?? 10, 1), 10080);
                member.mutedUntil = new Date(Date.now() + mins * 60000);
                await em.save(room_member_entity_1.RoomMember, member);
            }
            if (action === 'unmute') {
                if (!member)
                    throw new common_1.NotFoundException('Hedef kullanıcı odada değil');
                member.mutedUntil = null;
                await em.save(room_member_entity_1.RoomMember, member);
            }
            if (action === 'kick') {
                if (!member)
                    throw new common_1.NotFoundException('Hedef kullanıcı odada değil');
                await em.remove(room_member_entity_1.RoomMember, member);
            }
            if (action === 'ban') {
                const mins = durationMinutes ? Math.min(Math.max(durationMinutes, 1), 10080) : undefined;
                const expiresAt = mins ? new Date(Date.now() + mins * 60000) : null;
                if (existingBan) {
                    existingBan.actorId = actorId;
                    existingBan.reason = reason?.trim() || null;
                    existingBan.expiresAt = expiresAt;
                    await em.save(room_ban_entity_1.RoomBan, existingBan);
                }
                else
                    await em.save(room_ban_entity_1.RoomBan, em.create(room_ban_entity_1.RoomBan, { roomId, userId: targetUserId, actorId, reason: reason?.trim() || null, expiresAt }));
                if (member)
                    await em.remove(room_member_entity_1.RoomMember, member);
            }
            if (action === 'unban') {
                if (!existingBan)
                    throw new common_1.NotFoundException('Aktif yasak bulunamadı');
                await em.remove(room_ban_entity_1.RoomBan, existingBan);
            }
            await em.save(moderation_audit_entity_1.ModerationAudit, em.create(moderation_audit_entity_1.ModerationAudit, { actorId, targetUserId, roomId, messageId: null, action: `room.${action}`, reason: reason?.trim() || null, metadata: { actorStars: actor.rank.starCount, targetStars: target.rank.starCount, durationMinutes: durationMinutes ?? null } }));
            return { ok: true, roomId, targetUserId, action, forceLeave: action === 'kick' || action === 'ban' };
        });
    }
    async requireMember(roomId, userId) { const member = await this.members.findOneBy({ roomId, userId }); if (!member)
        throw new common_1.ForbiddenException('Önce odaya katılmalısın'); return member; }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(room_entity_1.Room)),
    __param(1, (0, typeorm_1.InjectRepository)(room_member_entity_1.RoomMember)),
    __param(2, (0, typeorm_1.InjectRepository)(message_entity_1.Message)),
    __param(3, (0, typeorm_1.InjectRepository)(room_read_entity_1.RoomRead)),
    __param(4, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(5, (0, typeorm_1.InjectRepository)(moderation_audit_entity_1.ModerationAudit)),
    __param(6, (0, typeorm_1.InjectRepository)(room_ban_entity_1.RoomBan)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.DataSource, media_service_1.MediaService])
], MessagesService);
//# sourceMappingURL=messages.service.js.map