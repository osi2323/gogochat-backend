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
exports.SocialService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../auth/user.entity");
const profile_entity_1 = require("../profiles/profile.entity");
const follow_entity_1 = require("./follow.entity");
const friendship_entity_1 = require("./friendship.entity");
const notifications_service_1 = require("../notifications/notifications.service");
const media_service_1 = require("../media/media.service");
const media_entity_1 = require("../media/media.entity");
let SocialService = class SocialService {
    users;
    profiles;
    follows;
    friendships;
    db;
    notifications;
    media;
    constructor(users, profiles, follows, friendships, db, notifications, media) {
        this.users = users;
        this.profiles = profiles;
        this.follows = follows;
        this.friendships = friendships;
        this.db = db;
        this.notifications = notifications;
        this.media = media;
    }
    async profile(userId) { const user = await this.users.findOne({ where: { id: userId }, relations: { rank: true } }); if (!user)
        throw new common_1.NotFoundException('Kullanıcı bulunamadı'); const p = await this.profiles.findOneBy({ userId }); const gallery = await this.db.query('SELECT m.id, m.public_url AS "publicUrl", m.mime_type AS "mimeType" FROM profile_gallery g JOIN media_assets m ON m.id=g.media_asset_id WHERE g.user_id=$1 AND m.deleted_at IS NULL ORDER BY g.position ASC', [userId]); const [followers, following] = await Promise.all([this.follows.countBy({ followingId: userId }), this.follows.countBy({ followerId: userId })]); return { user: { id: user.id, username: user.username, isGuest: user.isGuest, rank: user.rank }, profile: p ?? { userId, displayName: null, city: null, country: null, bio: null, avatarUrl: null, coverUrl: null, interests: [] }, stats: { followers, following }, gallery }; }
    async updateProfile(actorId, d) { let p = await this.profiles.findOneBy({ userId: actorId }); if (!p)
        p = this.profiles.create({ userId: actorId }); Object.assign(p, d, { interests: d.interests?.slice(0, 12).map(x => x.trim()).filter(Boolean) }); await this.profiles.save(p); return this.profile(actorId); }
    async setProfileMedia(actorId, purpose, assetId) { let oldId = null; const result = await this.db.transaction(async (m) => { let p = await m.getRepository(profile_entity_1.Profile).findOneBy({ userId: actorId }); if (!p)
        p = m.getRepository(profile_entity_1.Profile).create({ userId: actorId }); oldId = purpose === 'avatar' ? p.avatarAssetId : p.coverAssetId; const a = await this.media.claim(m, actorId, assetId, purpose, `profile.${purpose}`, assetId); if (purpose === 'avatar') {
        p.avatarAssetId = a.id;
        p.avatarUrl = a.publicUrl;
    }
    else {
        p.coverAssetId = a.id;
        p.coverUrl = a.publicUrl;
    } await m.getRepository(profile_entity_1.Profile).save(p); if (oldId && oldId !== a.id)
        await m.getRepository(media_entity_1.MediaAsset).update({ id: oldId, ownerId: actorId }, { attachedKind: null, attachedId: null, attachedAt: null }); return { assetId: a.id, url: a.publicUrl }; }); if (oldId && oldId !== assetId)
        await this.media.remove(actorId, oldId).catch(() => undefined); return result; }
    async addGallery(actorId, assetId) { return this.db.transaction(async (m) => { const count = Number((await m.query('SELECT COUNT(*)::int AS c FROM profile_gallery WHERE user_id=$1', [actorId]))[0]?.c ?? 0); if (count >= 24)
        throw new common_1.BadRequestException('Profil galerisi en fazla 24 fotoğraf olabilir'); const a = await this.media.claim(m, actorId, assetId, 'gallery', 'profile.gallery', assetId); const pos = Number((await m.query('SELECT COALESCE(MAX(position),-1)+1 AS p FROM profile_gallery WHERE user_id=$1', [actorId]))[0]?.p ?? 0); await m.query('INSERT INTO profile_gallery(user_id,media_asset_id,position) VALUES($1,$2,$3)', [actorId, a.id, pos]); return { id: a.id, publicUrl: a.publicUrl, mimeType: a.mimeType, position: pos }; }); }
    async removeGallery(actorId, assetId) { const result = await this.db.transaction(async (m) => { const rows = await m.query('DELETE FROM profile_gallery WHERE user_id=$1 AND media_asset_id=$2 RETURNING media_asset_id', [actorId, assetId]); if (!rows.length)
        throw new common_1.NotFoundException('Galeri görseli bulunamadı'); await m.getRepository(media_entity_1.MediaAsset).update({ id: assetId, ownerId: actorId }, { attachedKind: null, attachedId: null, attachedAt: null }); return { ok: true }; }); await this.media.remove(actorId, assetId).catch(() => undefined); return result; }
    async toggleFollow(actorId, targetId) { if (actorId === targetId)
        throw new common_1.BadRequestException('Kendini takip edemezsin'); if (!await this.users.existsBy({ id: targetId }))
        throw new common_1.NotFoundException(); const following = await this.db.transaction(async (m) => { await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`follow:${actorId}:${targetId}`]); const repo = m.getRepository(follow_entity_1.Follow), row = await repo.findOneBy({ followerId: actorId, followingId: targetId }); if (row) {
        await repo.remove(row);
        return false;
    } await repo.insert({ followerId: actorId, followingId: targetId }); return true; }); if (following)
        await this.notifications.create(targetId, 'social.follow', actorId, {}); return { following }; }
    async requestFriend(actorId, targetId) { if (actorId === targetId)
        throw new common_1.BadRequestException('Kendine arkadaşlık isteği gönderemezsin'); if (!await this.users.existsBy({ id: targetId }))
        throw new common_1.NotFoundException(); const pair = [actorId, targetId].sort().join(':'); const result = await this.db.transaction(async (m) => { await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`friend:${pair}`]); const repo = m.getRepository(friendship_entity_1.Friendship); const existing = await repo.createQueryBuilder('f').where('(f.requesterId=:a AND f.addresseeId=:b) OR (f.requesterId=:b AND f.addresseeId=:a)', { a: actorId, b: targetId }).getOne(); if (existing) {
        if (existing.status === 'accepted')
            return { row: existing, notify: false };
        if (existing.status === 'pending')
            throw new common_1.BadRequestException('Bekleyen bir istek zaten var');
        existing.requesterId = actorId;
        existing.addresseeId = targetId;
        existing.status = 'pending';
        return { row: await repo.save(existing), notify: true };
    } const row = await repo.save(repo.create({ requesterId: actorId, addresseeId: targetId, status: 'pending' })); return { row, notify: true }; }); if (result.notify)
        await this.notifications.create(targetId, 'friend.request', actorId, { requestId: result.row.id }); return result.row; }
    async respond(actorId, id, accept) { const f = await this.friendships.findOneBy({ id }); if (!f)
        throw new common_1.NotFoundException(); if (f.addresseeId !== actorId)
        throw new common_1.ForbiddenException(); if (f.status !== 'pending')
        throw new common_1.BadRequestException('İstek zaten sonuçlandırılmış'); f.status = accept ? 'accepted' : 'rejected'; const saved = await this.friendships.save(f); await this.notifications.create(f.requesterId, accept ? 'friend.accepted' : 'friend.rejected', actorId, { requestId: f.id }); return saved; }
    async friendshipState(actorId, targetId) { if (actorId === targetId)
        return { status: 'self', requestId: null, incoming: false }; const f = await this.friendships.createQueryBuilder('f').where('(f.requesterId=:a AND f.addresseeId=:b) OR (f.requesterId=:b AND f.addresseeId=:a)', { a: actorId, b: targetId }).getOne(); if (!f)
        return { status: 'none', requestId: null, incoming: false }; return { status: f.status, requestId: f.id, incoming: f.status === 'pending' && f.addresseeId === actorId }; }
    async pendingRequests(actorId) { const rows = await this.friendships.find({ where: { addresseeId: actorId, status: 'pending' } }); if (!rows.length)
        return []; const ids = rows.map(x => x.requesterId); const users = await this.users.createQueryBuilder('u').leftJoinAndSelect('u.rank', 'rank').leftJoinAndMapOne('u.profile', profile_entity_1.Profile, 'p', 'p.user_id=u.id').where('u.id IN (:...ids)', { ids }).getMany(); const byId = new Map(users.map((u) => [u.id, u])); return rows.map(r => ({ id: r.id, createdAt: r.createdAt, user: byId.get(r.requesterId) })).filter(x => x.user); }
    async discover(actorId, q = '') { const term = q.trim().slice(0, 40); const qb = this.users.createQueryBuilder('u').leftJoinAndSelect('u.rank', 'rank').leftJoinAndMapOne('u.profile', profile_entity_1.Profile, 'p', 'p.user_id=u.id').where('u.id <> :actorId', { actorId }).andWhere('u.is_guest = false'); if (term)
        qb.andWhere('(u.username ILIKE :q OR p.display_name ILIKE :q OR p.city ILIKE :q OR p.country ILIKE :q)', { q: `%${term}%` }); const rows = await qb.orderBy('u.username', 'ASC').take(40).getMany(); return rows.map((u) => ({ id: u.id, username: u.username, isGuest: u.isGuest, rank: u.rank, profile: u.profile ?? null })); }
    async friends(actorId) { const rows = await this.friendships.createQueryBuilder('f').where('f.status = :s AND (f.requesterId=:u OR f.addresseeId=:u)', { s: 'accepted', u: actorId }).getMany(); const ids = rows.map(x => x.requesterId === actorId ? x.addresseeId : x.requesterId); if (!ids.length)
        return []; return this.users.createQueryBuilder('u').leftJoinAndSelect('u.rank', 'rank').leftJoinAndMapOne('u.profile', profile_entity_1.Profile, 'p', 'p.user_id=u.id').where('u.id IN (:...ids)', { ids }).getMany(); }
};
exports.SocialService = SocialService;
exports.SocialService = SocialService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(profile_entity_1.Profile)),
    __param(2, (0, typeorm_1.InjectRepository)(follow_entity_1.Follow)),
    __param(3, (0, typeorm_1.InjectRepository)(friendship_entity_1.Friendship)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.DataSource, notifications_service_1.NotificationsService, media_service_1.MediaService])
], SocialService);
//# sourceMappingURL=social.service.js.map