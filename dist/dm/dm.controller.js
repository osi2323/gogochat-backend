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
exports.DmController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const dm_service_1 = require("./dm.service");
const dm_dto_1 = require("./dm.dto");
let DmController = class DmController {
    s;
    constructor(s) {
        this.s = s;
    }
    list(r) { return this.s.list(r.user.id); }
    open(r, id) { return this.s.open(r.user.id, id); }
    history(r, id, before) { return this.s.history(r.user.id, id, before); }
    read(r, id, d) { return this.s.markRead(r.user.id, id, d.messageId); }
    unread(r, id) { return this.s.unreadCount(r.user.id, id).then(count => ({ count })); }
    send(r, id, d) { return this.s.send(r.user.id, id, d.clientId, d.body, d.mediaAssetId); }
};
exports.DmController = DmController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DmController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('open/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DmController.prototype, "open", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('before')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], DmController.prototype, "history", null);
__decorate([
    (0, common_1.Post)(':id/read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], DmController.prototype, "read", null);
__decorate([
    (0, common_1.Get)(':id/unread'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DmController.prototype, "unread", null);
__decorate([
    (0, common_1.Post)(':id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, dm_dto_1.SendDmDto]),
    __metadata("design:returntype", void 0)
], DmController.prototype, "send", null);
exports.DmController = DmController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtGuard),
    (0, common_1.Controller)('dm'),
    __metadata("design:paramtypes", [dm_service_1.DmService])
], DmController);
//# sourceMappingURL=dm.controller.js.map