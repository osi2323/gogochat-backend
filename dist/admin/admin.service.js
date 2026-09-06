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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../auth/user.entity");
const rank_entity_1 = require("../ranks/rank.entity");
const room_entity_1 = require("../rooms/room.entity");
const message_entity_1 = require("../messages/message.entity");
const moderation_audit_entity_1 = require("../messages/moderation-audit.entity");
const site_setting_entity_1 = require("./site-setting.entity");
const wall_entity_1 = require("../social/wall.entity");
const rank_policy_1 = require("../common/rank-policy");
let AdminService = class AdminService {
    users;
    ranks;
    rooms;
    messages;
    audits;
    settings;
    wallPosts;
    wallComments;
    constructor(users, ranks, rooms, messages, audits, settings, wallPosts, wallComments) {
        this.users = users;
        this.ranks = ranks;
        this.rooms = rooms;
        this.messages = messages;
        this.audits = audits;
        this.settings = settings;
        this.wallPosts = wallPosts;
        this.wallComments = wallComments;
    }
    async actor(id) { const u = await this.users.findOne({ where: { id }, relations: { rank: true } }); if (!u)
        throw new common_1.NotFoundException(); if (!u.rank.permissions?.['admin.access'])
        throw new common_1.ForbiddenException('Admin erişimin yok.'); return u; }
    permit(a, p) { if (!a.rank.permissions?.[p] && !a.rank.permissions?.['admin.all'])
        throw new common_1.ForbiddenException('Bu admin işlemi için yetkin yok.'); }
    async overview(id) { await this.actor(id); const [userCount, roomCount, messageCount, auditCount] = await Promise.all([this.users.count(), this.rooms.count(), this.messages.count({ where: { deletedAt: (0, typeorm_2.IsNull)() } }), this.audits.count()]); const recent = await this.audits.find({ order: { createdAt: 'DESC' }, take: 8 }); return { userCount, roomCount, messageCount, auditCount, recent }; }
    async listUsers(id, q = '') { await this.actor(id); return this.users.createQueryBuilder('u').leftJoinAndSelect('u.rank', 'rank').where(q ? 'LOWER(u.username) LIKE LOWER(:q)' : '1=1', { q: `%${q}%` }).orderBy('rank.starCount', 'DESC').addOrderBy('u.username', 'ASC').take(100).getMany(); }
    async setRank(id, targetId, d) { const a = await this.actor(id); this.permit(a, 'admin.users'); const t = await this.users.findOne({ where: { id: targetId }, relations: { rank: true } }); if (!t)
        throw new common_1.NotFoundException('Kullanıcı bulunamadı.'); (0, rank_policy_1.assertCanGrantRank)(a, t, d.starCount); const r = await this.ranks.findOneBy({ starCount: d.starCount }); if (!r)
        throw new common_1.NotFoundException('Rütbe bulunamadı.'); t.rankId = r.id; await this.users.save(t); await this.audits.save(this.audits.create({ actorId: a.id, targetUserId: t.id, roomId: null, messageId: null, action: 'admin.rank.change', reason: null, metadata: { from: t.rank.starCount, to: r.starCount } })); return { ...t, rank: r }; }
    async updateRank(id, stars, d) { const a = await this.actor(id); this.permit(a, 'admin.ranks'); if (stars === 27)
        throw new common_1.ForbiddenException('⭐27 Site Sahibi korumalıdır.'); if (stars >= a.rank.starCount)
        throw new common_1.ForbiddenException('Kendi rütbene eşit/yüksek rütbeyi düzenleyemezsin.'); const r = await this.ranks.findOneBy({ starCount: stars }); if (!r)
        throw new common_1.NotFoundException(); if (d.permissions) {
        for (const v of Object.values(d.permissions))
            if (typeof v !== 'boolean')
                throw new common_1.ForbiddenException('İzin değerleri boolean olmalı.');
    } Object.assign(r, d); return this.ranks.save(r); }
    async listRooms(id) { await this.actor(id); return this.rooms.find({ order: { createdAt: 'ASC' } }); }
    async updateRoom(id, roomId, d) { const a = await this.actor(id); this.permit(a, 'admin.rooms'); const r = await this.rooms.findOneBy({ id: roomId }); if (!r)
        throw new common_1.NotFoundException(); Object.assign(r, d); return this.rooms.save(r); }
    async content(id, q = '') { const a = await this.actor(id); this.permit(a, 'admin.content'); const qb = this.wallPosts.createQueryBuilder('p').withDeleted().leftJoin(user_entity_1.User, 'u', 'u.id=p.author_id').select(['p.id AS id', 'p.body AS body', 'p.created_at AS "createdAt"', 'p.deleted_at AS "deletedAt"', 'p.author_id AS "authorId"', 'u.username AS username']).orderBy('p.created_at', 'DESC').limit(100); if (q.trim())
        qb.where('(LOWER(p.body) LIKE LOWER(:q) OR LOWER(u.username) LIKE LOWER(:q))', { q: `%${q.trim()}%` }); return qb.getRawMany(); }
    async removeContent(id, postId, reason) { const a = await this.actor(id); this.permit(a, 'admin.content'); const p = await this.wallPosts.findOne({ where: { id: postId }, withDeleted: true }); if (!p)
        throw new common_1.NotFoundException('Paylaşım bulunamadı.'); if (p.deletedAt)
        return { ok: true, id: postId, alreadyDeleted: true }; await this.wallPosts.softDelete(postId); await this.audits.save(this.audits.create({ actorId: a.id, targetUserId: p.authorId, roomId: null, messageId: null, action: 'admin.wall.delete', reason: reason?.trim() || 'Admin içerik moderasyonu', metadata: { postId } })); return { ok: true, id: postId }; }
    async audit(id) { const a = await this.actor(id); this.permit(a, 'room.audit'); return this.audits.find({ order: { createdAt: 'DESC' }, take: 100 }); }
    async getSettings(id) { await this.actor(id); return this.settings.find({ order: { key: 'ASC' } }); }
    async setSetting(id, d) { const a = await this.actor(id); this.permit(a, 'admin.settings'); return this.settings.save(this.settings.create({ key: d.key, value: d.value })); }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(rank_entity_1.Rank)),
    __param(2, (0, typeorm_1.InjectRepository)(room_entity_1.Room)),
    __param(3, (0, typeorm_1.InjectRepository)(message_entity_1.Message)),
    __param(4, (0, typeorm_1.InjectRepository)(moderation_audit_entity_1.ModerationAudit)),
    __param(5, (0, typeorm_1.InjectRepository)(site_setting_entity_1.SiteSetting)),
    __param(6, (0, typeorm_1.InjectRepository)(wall_entity_1.WallPost)),
    __param(7, (0, typeorm_1.InjectRepository)(wall_entity_1.WallComment)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository])
], AdminService);
//# sourceMappingURL=admin.service.js.map