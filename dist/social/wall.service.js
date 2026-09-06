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
exports.WallService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../auth/user.entity");
const notifications_service_1 = require("../notifications/notifications.service");
const profile_entity_1 = require("../profiles/profile.entity");
const media_service_1 = require("../media/media.service");
const media_entity_1 = require("../media/media.entity");
const follow_entity_1 = require("./follow.entity");
const wall_entity_1 = require("./wall.entity");
const site_config_service_1 = require("../site-config/site-config.service");
let WallService = class WallService {
    posts;
    comments;
    likes;
    users;
    follows;
    notifications;
    db;
    media;
    siteConfig;
    constructor(posts, comments, likes, users, follows, notifications, db, media, siteConfig) {
        this.posts = posts;
        this.comments = comments;
        this.likes = likes;
        this.users = users;
        this.follows = follows;
        this.notifications = notifications;
        this.db = db;
        this.media = media;
        this.siteConfig = siteConfig;
    }
    async decorate(rows, viewerId) { if (!rows.length)
        return []; const ids = rows.map(x => x.id), authorIds = [...new Set(rows.map(x => x.authorId))]; const [users, counts, comments, mine] = await Promise.all([this.users.createQueryBuilder('u').leftJoinAndSelect('u.rank', 'rank').leftJoinAndMapOne('u.profile', profile_entity_1.Profile, 'p', 'p.user_id=u.id').where('u.id IN (:...ids)', { ids: authorIds }).getMany(), this.likes.createQueryBuilder('l').select('l.postId', 'postId').addSelect('COUNT(*)', 'count').where('l.postId IN (:...ids)', { ids }).groupBy('l.postId').getRawMany(), this.comments.createQueryBuilder('c').where('c.postId IN (:...ids)', { ids }).orderBy('c.createdAt', 'ASC').take(300).getMany(), this.likes.findBy(ids.map(postId => ({ postId, userId: viewerId })))]); const um = new Map(users.map(u => [u.id, u])), cm = new Map(counts.map((x) => [x.postId, Number(x.count)])), liked = new Set(mine.map(x => x.postId)); const commentAuthors = [...new Set(comments.map(x => x.authorId))]; const cu = commentAuthors.length ? await this.users.createQueryBuilder('u').leftJoinAndMapOne('u.profile', profile_entity_1.Profile, 'p', 'p.user_id=u.id').where('u.id IN (:...ids)', { ids: commentAuthors }).getMany() : []; const cum = new Map(cu.map(u => [u.id, u])); const mediaIds = rows.map(p => p.mediaAssetId).filter(Boolean); const assets = mediaIds.length ? await this.db.getRepository(media_entity_1.MediaAsset).findByIds(mediaIds) : []; const am = new Map(assets.map(a => [a.id, a])); return rows.map(p => ({ id: p.id, body: p.body, media: p.mediaAssetId ? am.get(p.mediaAssetId) ?? null : null, createdAt: p.createdAt, author: um.get(p.authorId), likeCount: cm.get(p.id) ?? 0, likedByMe: liked.has(p.id), comments: comments.filter(c => c.postId === p.id).slice(-20).map(c => ({ id: c.id, body: c.body, createdAt: c.createdAt, author: cum.get(c.authorId) })) })); }
    async feed(viewerId, before, authorId) { if (!await this.siteConfig.enabled('wall.enabled', true))
        throw new common_1.ForbiddenException('Paylaşım Duvarı şu anda kapalı'); let q = this.posts.createQueryBuilder('p').where('p.deletedAt IS NULL').orderBy('p.createdAt', 'DESC').addOrderBy('p.id', 'DESC').take(30); if (authorId)
        q = q.andWhere('p.authorId=:authorId', { authorId });
    else {
        const following = (await this.follows.findBy({ followerId: viewerId })).map(x => x.followingId);
        if (following.length)
            q = q.andWhere('p.authorId IN (:...authors)', { authors: [viewerId, ...following] });
    } if (before) {
        const cursor = await this.posts.findOneBy({ id: before });
        if (cursor)
            q = q.andWhere('(p.createdAt < :d OR (p.createdAt = :d AND p.id < :id))', { d: cursor.createdAt, id: cursor.id });
    } const rows = await q.getMany(); return { items: await this.decorate(rows, viewerId), nextCursor: rows.length === 30 ? rows.at(-1).id : null }; }
    async create(actorId, body, mediaAssetId) { if (!await this.siteConfig.enabled('wall.enabled', true))
        throw new common_1.ForbiddenException('Paylaşım Duvarı şu anda kapalı'); const clean = body.trim(); if (!clean && !mediaAssetId)
        throw new common_1.BadRequestException('Paylaşım boş olamaz'); const p = await this.db.transaction(async (m) => { const post = await m.getRepository(wall_entity_1.WallPost).save(m.getRepository(wall_entity_1.WallPost).create({ authorId: actorId, body: clean, mediaAssetId: null })); if (mediaAssetId) {
        const a = await this.media.claim(m, actorId, mediaAssetId, 'wall', 'wall.post', post.id);
        post.mediaAssetId = a.id;
        await m.getRepository(wall_entity_1.WallPost).save(post);
    } return post; }); return (await this.decorate([p], actorId))[0]; }
    async update(actorId, postId, body) { if (!await this.siteConfig.enabled('wall.enabled', true))
        throw new common_1.ForbiddenException('Paylaşım Duvarı şu anda kapalı'); const p = await this.posts.findOneBy({ id: postId }); if (!p)
        throw new common_1.NotFoundException('Paylaşım bulunamadı'); if (p.authorId !== actorId)
        throw new common_1.ForbiddenException('Bu paylaşımı düzenleyemezsin'); const clean = body.trim(); if (!clean)
        throw new common_1.BadRequestException('Paylaşım boş olamaz'); p.body = clean; await this.posts.save(p); return (await this.decorate([p], actorId))[0]; }
    async remove(actorId, postId) { if (!await this.siteConfig.enabled('wall.enabled', true))
        throw new common_1.ForbiddenException('Paylaşım Duvarı şu anda kapalı'); const p = await this.posts.findOneBy({ id: postId }); if (!p)
        throw new common_1.NotFoundException('Paylaşım bulunamadı'); if (p.authorId !== actorId)
        throw new common_1.ForbiddenException('Bu paylaşımı silemezsin'); await this.posts.softDelete(postId); return { ok: true, id: postId }; }
    async toggleLike(actorId, postId) { if (!await this.siteConfig.enabled('wall.enabled', true))
        throw new common_1.ForbiddenException('Paylaşım Duvarı şu anda kapalı'); const post = await this.posts.findOneBy({ id: postId }); if (!post)
        throw new common_1.NotFoundException('Paylaşım bulunamadı'); const result = await this.db.transaction(async (m) => { await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`wall-like:${postId}:${actorId}`]); const repo = m.getRepository(wall_entity_1.WallLike), row = await repo.findOneBy({ postId, userId: actorId }); if (row) {
        await repo.remove(row);
        return { liked: false, count: await repo.countBy({ postId }) };
    } await repo.insert({ postId, userId: actorId }); return { liked: true, count: await repo.countBy({ postId }) }; }); if (result.liked)
        await this.notifications.create(post.authorId, 'wall.like', actorId, { postId }); return result; }
    async comment(actorId, postId, body) { if (!await this.siteConfig.enabled('wall.enabled', true))
        throw new common_1.ForbiddenException('Paylaşım Duvarı şu anda kapalı'); if (!await this.posts.existsBy({ id: postId }))
        throw new common_1.NotFoundException('Paylaşım bulunamadı'); const clean = body.trim(); if (!clean)
        throw new common_1.BadRequestException('Yorum boş olamaz'); const c = await this.comments.save(this.comments.create({ postId, authorId: actorId, body: clean })); const post = await this.posts.findOneBy({ id: postId }); if (post)
        await this.notifications.create(post.authorId, 'wall.comment', actorId, { postId, commentId: c.id }); const u = await this.users.createQueryBuilder('u').leftJoinAndMapOne('u.profile', profile_entity_1.Profile, 'p', 'p.user_id=u.id').where('u.id=:id', { id: actorId }).getOne(); return { id: c.id, body: c.body, createdAt: c.createdAt, author: u }; }
};
exports.WallService = WallService;
exports.WallService = WallService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(wall_entity_1.WallPost)),
    __param(1, (0, typeorm_1.InjectRepository)(wall_entity_1.WallComment)),
    __param(2, (0, typeorm_1.InjectRepository)(wall_entity_1.WallLike)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(4, (0, typeorm_1.InjectRepository)(follow_entity_1.Follow)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, notifications_service_1.NotificationsService, typeorm_2.DataSource, media_service_1.MediaService, site_config_service_1.SiteConfigService])
], WallService);
//# sourceMappingURL=wall.service.js.map