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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const admin_service_1 = require("./admin.service");
const admin_dto_1 = require("./admin.dto");
let AdminController = class AdminController {
    a;
    constructor(a) {
        this.a = a;
    }
    overview(r) { return this.a.overview(r.user.id); }
    users(r, q) { return this.a.listUsers(r.user.id, q); }
    rankUser(r, id, d) { return this.a.setRank(r.user.id, id, d); }
    rank(r, s, d) { return this.a.updateRank(r.user.id, s, d); }
    rooms(r) { return this.a.listRooms(r.user.id); }
    room(r, id, d) { return this.a.updateRoom(r.user.id, id, d); }
    content(r, q) { return this.a.content(r.user.id, q); }
    removeContent(r, id, d) { return this.a.removeContent(r.user.id, id, d?.reason); }
    audit(r) { return this.a.audit(r.user.id); }
    settings(r) { return this.a.getSettings(r.user.id); }
    setting(r, d) { return this.a.setSetting(r.user.id, d); }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('overview'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "users", null);
__decorate([
    (0, common_1.Patch)('users/:id/rank'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_dto_1.SetUserRankDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "rankUser", null);
__decorate([
    (0, common_1.Patch)('ranks/:stars'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('stars', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, admin_dto_1.UpdateRankDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "rank", null);
__decorate([
    (0, common_1.Get)('rooms'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "rooms", null);
__decorate([
    (0, common_1.Patch)('rooms/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_dto_1.UpdateRoomDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "room", null);
__decorate([
    (0, common_1.Get)('content'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "content", null);
__decorate([
    (0, common_1.Delete)('content/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "removeContent", null);
__decorate([
    (0, common_1.Get)('audit'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "audit", null);
__decorate([
    (0, common_1.Get)('settings'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "settings", null);
__decorate([
    (0, common_1.Post)('settings'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, admin_dto_1.UpdateSettingDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "setting", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtGuard),
    (0, common_1.Controller)('admin'),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map