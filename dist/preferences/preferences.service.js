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
exports.PreferencesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_preference_entity_1 = require("./user-preference.entity");
let PreferencesService = class PreferencesService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async get(userId) { let p = await this.repo.findOneBy({ userId }); if (!p)
        p = await this.repo.save(this.repo.create({ userId })); return p; }
    async update(userId, d) { const p = await this.get(userId); Object.assign(p, d); return this.repo.save(p); }
    async publicPrivacy(userId) { const p = await this.get(userId); return { allowPrivateMessages: p.allowPrivateMessages, allowVoiceCalls: p.allowVoiceCalls, allowVideoCalls: p.allowVideoCalls, showOnlineStatus: p.showOnlineStatus }; }
    async canReceiveDm(userId) { return (await this.get(userId)).allowPrivateMessages; }
    async canUseVoice(userId) { return (await this.get(userId)).allowVoiceCalls; }
    async notificationEnabled(userId, type) { const p = await this.get(userId); if (type.startsWith('dm.'))
        return p.notifyDm; if (type.startsWith('friend.'))
        return p.notifyFriend; if (type.startsWith('follow.') || type.startsWith('social.follow'))
        return p.notifyFollow; if (type.startsWith('wall.'))
        return p.notifyWall; return true; }
    async visibleOnlineUserIds(ids) { if (!ids.length)
        return []; const rows = await this.repo.find({ where: { userId: (0, typeorm_2.In)(ids) } }); const hidden = new Set(rows.filter(x => !x.showOnlineStatus).map(x => x.userId)); return ids.filter(id => !hidden.has(id)); }
};
exports.PreferencesService = PreferencesService;
exports.PreferencesService = PreferencesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_preference_entity_1.UserPreference)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PreferencesService);
//# sourceMappingURL=preferences.service.js.map