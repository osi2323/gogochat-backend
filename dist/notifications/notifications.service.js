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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_entity_1 = require("./notification.entity");
const preferences_service_1 = require("../preferences/preferences.service");
let NotificationsService = class NotificationsService {
    repo;
    prefs;
    constructor(repo, prefs) {
        this.repo = repo;
        this.prefs = prefs;
    }
    async create(userId, type, actorId, data = {}) { if (userId === actorId)
        return null; if (!await this.prefs.notificationEnabled(userId, type))
        return null; return this.repo.save(this.repo.create({ userId, type, actorId, data, readAt: null })); }
    async list(userId, before) { let q = this.repo.createQueryBuilder('n').where('n.userId=:userId', { userId }).orderBy('n.createdAt', 'DESC').addOrderBy('n.id', 'DESC').take(40); if (before) {
        const c = await this.repo.findOneBy({ id: before, userId });
        if (c)
            q = q.andWhere('(n.createdAt < :d OR (n.createdAt=:d AND n.id<:id))', { d: c.createdAt, id: c.id });
    } const items = await q.getMany(); return { items, nextCursor: items.length === 40 ? items.at(-1).id : null, unreadCount: await this.repo.countBy({ userId, readAt: (0, typeorm_2.IsNull)() }) }; }
    unreadCount(userId) { return this.repo.countBy({ userId, readAt: (0, typeorm_2.IsNull)() }); }
    async read(userId, id) { const n = await this.repo.findOneBy({ id, userId }); if (!n)
        throw new common_1.NotFoundException('Bildirim bulunamadı'); if (!n.readAt) {
        n.readAt = new Date();
        await this.repo.save(n);
    } return { ok: true, readAt: n.readAt }; }
    async readAll(userId) { await this.repo.createQueryBuilder().update(notification_entity_1.Notification).set({ readAt: new Date() }).where('user_id=:userId AND read_at IS NULL', { userId }).execute(); return { ok: true }; }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.Repository, preferences_service_1.PreferencesService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map