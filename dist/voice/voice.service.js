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
exports.VoiceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const livekit_server_sdk_1 = require("livekit-server-sdk");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../auth/user.entity");
const room_entity_1 = require("../rooms/room.entity");
const room_member_entity_1 = require("../messages/room-member.entity");
const room_ban_entity_1 = require("../messages/room-ban.entity");
const moderation_audit_entity_1 = require("../messages/moderation-audit.entity");
const rank_policy_1 = require("../common/rank-policy");
const voice_session_entity_1 = require("./voice-session.entity");
const preferences_service_1 = require("../preferences/preferences.service");
const site_config_service_1 = require("../site-config/site-config.service");
let VoiceService = class VoiceService {
    sessions;
    db;
    prefs;
    siteConfig;
    timer;
    url = process.env.LIVEKIT_URL ?? '';
    key = process.env.LIVEKIT_API_KEY ?? '';
    secret = process.env.LIVEKIT_API_SECRET ?? '';
    roomClient;
    constructor(sessions, db, prefs, siteConfig) {
        this.sessions = sessions;
        this.db = db;
        this.prefs = prefs;
        this.siteConfig = siteConfig;
        if (this.url && this.key && this.secret)
            this.roomClient = new livekit_server_sdk_1.RoomServiceClient(this.url, this.key, this.secret);
    }
    onModuleInit() { this.timer = setInterval(() => void this.expireSessions(), 15000); this.timer.unref?.(); }
    onModuleDestroy() { if (this.timer)
        clearInterval(this.timer); }
    configured() { if (!this.url || !this.key || !this.secret || !this.roomClient)
        throw new common_1.ServiceUnavailableException('Ses servisi yapılandırılmamış'); }
    async issue(roomId, userId) { this.configured(); if (!await this.siteConfig.enabled('voice.enabled', true))
        throw new common_1.ForbiddenException('Mikrofon özelliği şu anda kapalı'); if (!await this.prefs.canUseVoice(userId))
        throw new common_1.ForbiddenException('Sesli iletişim ayarın kapalı.'); const result = await this.db.transaction(async (em) => { const [room, user, member] = await Promise.all([em.findOneBy(room_entity_1.Room, { id: roomId }), em.findOne(user_entity_1.User, { where: { id: userId }, relations: { rank: true } }), em.findOneBy(room_member_entity_1.RoomMember, { roomId, userId })]); if (!room)
        throw new common_1.NotFoundException('Oda bulunamadı'); if (!user || !member)
        throw new common_1.ForbiddenException('Ses için önce odaya katılmalısın'); const ban = await em.findOneBy(room_ban_entity_1.RoomBan, { roomId, userId }); if (ban && (!ban.expiresAt || ban.expiresAt > new Date()))
        throw new common_1.ForbiddenException('Bu odadan yasaklandın'); const seconds = Math.max(0, Number(user.rank?.microphoneDuration ?? 0)); if (seconds < 1)
        throw new common_1.ForbiddenException('Rütben için mikrofon süresi tanımlı değil'); const now = new Date(); const other = await em.findOne(voice_session_entity_1.VoiceSession, { where: { userId, endedAt: (0, typeorm_2.IsNull)() }, lock: { mode: 'pessimistic_write' } }); if (other && other.roomId !== roomId && other.expiresAt > now)
        throw new common_1.ConflictException('Başka bir odada aktif mikrofonun var'); if (other && other.expiresAt <= now) {
        other.endedAt = now;
        await em.save(other);
    } let session = await em.findOne(voice_session_entity_1.VoiceSession, { where: { roomId, userId, endedAt: (0, typeorm_2.IsNull)() }, lock: { mode: 'pessimistic_write' } }); if (session && session.expiresAt <= now) {
        session.endedAt = now;
        await em.save(session);
        session = null;
    } if (!session) {
        const active = await em.count(voice_session_entity_1.VoiceSession, { where: { roomId, endedAt: (0, typeorm_2.IsNull)() } });
        if (active >= room.maxMicrophones)
            throw new common_1.ConflictException(`Bu odadaki ${room.maxMicrophones} mikrofon dolu`);
        session = await em.save(voice_session_entity_1.VoiceSession, em.create(voice_session_entity_1.VoiceSession, { roomId, userId, participantIdentity: `${userId}:${crypto.randomUUID()}`, startedAt: now, expiresAt: new Date(now.getTime() + seconds * 1000), endedAt: null }));
    } return { session, user, room }; }); const ttl = Math.max(1, Math.ceil((result.session.expiresAt.getTime() - Date.now()) / 1000)); const at = new livekit_server_sdk_1.AccessToken(this.key, this.secret, { identity: result.session.participantIdentity, name: result.user.username, ttl, metadata: JSON.stringify({ userId: result.user.id, username: result.user.username, starCount: result.user.rank.starCount, rankName: result.user.rank.name, sessionId: result.session.id }) }); at.addGrant({ roomJoin: true, room: `gogochat-${roomId}`, canPublish: true, canSubscribe: true, canPublishData: true }); return { url: this.url, token: await at.toJwt(), sessionId: result.session.id, expiresAt: result.session.expiresAt.toISOString(), remainingSeconds: ttl, maxMicrophones: result.room.maxMicrophones }; }
    async leave(roomId, userId) { const active = await this.sessions.findOneBy({ roomId, userId, endedAt: (0, typeorm_2.IsNull)() }); if (!active)
        return { ok: true }; active.endedAt = new Date(); await this.sessions.save(active); await this.removeParticipant(roomId, active.participantIdentity); return { ok: true }; }
    async status(roomId, userId) { const [s, room] = await Promise.all([this.sessions.findOneBy({ roomId, userId, endedAt: (0, typeorm_2.IsNull)() }), this.db.getRepository(room_entity_1.Room).findOneBy({ id: roomId })]); const activeCount = await this.sessions.count({ where: { roomId, endedAt: (0, typeorm_2.IsNull)() } }); if (!s || s.expiresAt <= new Date())
        return { active: false, remainingSeconds: 0, expiresAt: null, activeCount, maxMicrophones: room?.maxMicrophones ?? 5 }; return { active: true, remainingSeconds: Math.max(0, Math.ceil((s.expiresAt.getTime() - Date.now()) / 1000)), expiresAt: s.expiresAt.toISOString(), activeCount, maxMicrophones: room?.maxMicrophones ?? 5 }; }
    async participants(roomId, userId) { const member = await this.db.getRepository(room_member_entity_1.RoomMember).findOneBy({ roomId, userId }); if (!member)
        throw new common_1.ForbiddenException('Önce odaya katılmalısın'); const rows = await this.sessions.find({ where: { roomId, endedAt: (0, typeorm_2.IsNull)() }, order: { startedAt: 'ASC' } }); const ids = rows.map(x => x.userId); if (!ids.length)
        return []; const users = await this.db.getRepository(user_entity_1.User).createQueryBuilder('u').leftJoinAndSelect('u.rank', 'rank').where('u.id IN (:...ids)', { ids }).getMany(); const map = new Map(users.map(u => [u.id, u])); return rows.filter(x => x.expiresAt > new Date()).map(x => { const u = map.get(x.userId); return { sessionId: x.id, userId: x.userId, username: u?.username ?? 'Kullanıcı', starCount: u?.rank?.starCount ?? 1, rankName: u?.rank?.name ?? 'Üye', startedAt: x.startedAt, expiresAt: x.expiresAt }; }); }
    async forceLeave(roomId, actorId, targetUserId, reason) { this.configured(); const result = await this.db.transaction(async (em) => { const [actor, target, session] = await Promise.all([em.findOne(user_entity_1.User, { where: { id: actorId }, relations: { rank: true } }), em.findOne(user_entity_1.User, { where: { id: targetUserId }, relations: { rank: true } }), em.findOne(voice_session_entity_1.VoiceSession, { where: { roomId, userId: targetUserId, endedAt: (0, typeorm_2.IsNull)() }, lock: { mode: 'pessimistic_write' } })]); if (!actor || !target)
        throw new common_1.NotFoundException('Kullanıcı bulunamadı'); (0, rank_policy_1.assertCanAct)(actor, target, 'room.voiceModerate'); if (!session)
        throw new common_1.NotFoundException('Kullanıcı mikrofonda değil'); session.endedAt = new Date(); await em.save(session); await em.save(moderation_audit_entity_1.ModerationAudit, em.create(moderation_audit_entity_1.ModerationAudit, { actorId, targetUserId, roomId, messageId: null, action: 'voice.remove', reason: reason?.trim().slice(0, 500) || null, metadata: { targetStars: target.rank.starCount, sessionId: session.id } })); return session; }); await this.removeParticipant(roomId, result.participantIdentity); return { ok: true, userId: targetUserId }; }
    async expireSessions() { if (!this.roomClient)
        return; const due = await this.sessions.find({ where: { endedAt: (0, typeorm_2.IsNull)(), expiresAt: (0, typeorm_2.LessThanOrEqual)(new Date()) }, take: 100 }); for (const s of due) {
        try {
            await this.removeParticipant(s.roomId, s.participantIdentity);
        }
        catch { }
        s.endedAt = new Date();
        await this.sessions.save(s).catch(() => undefined);
    } }
    async removeParticipant(roomId, identity) { if (!this.roomClient)
        return; try {
        await this.roomClient.removeParticipant(`gogochat-${roomId}`, identity);
    }
    catch (e) {
        if (!/not found|does not exist/i.test(String(e?.message ?? e)))
            throw e;
    } }
};
exports.VoiceService = VoiceService;
exports.VoiceService = VoiceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(voice_session_entity_1.VoiceSession)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeorm_2.DataSource, preferences_service_1.PreferencesService, site_config_service_1.SiteConfigService])
], VoiceService);
//# sourceMappingURL=voice.service.js.map