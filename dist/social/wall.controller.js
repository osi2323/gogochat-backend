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
exports.WallController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const wall_dto_1 = require("./wall.dto");
const wall_service_1 = require("./wall.service");
let WallController = class WallController {
    w;
    constructor(w) {
        this.w = w;
    }
    feed(r, before, authorId) { return this.w.feed(r.user.id, before, authorId); }
    create(r, d) { return this.w.create(r.user.id, d.body ?? '', d.mediaAssetId); }
    update(r, id, d) { return this.w.update(r.user.id, id, d.body); }
    remove(r, id) { return this.w.remove(r.user.id, id); }
    like(r, id) { return this.w.toggleLike(r.user.id, id); }
    comment(r, id, d) { return this.w.comment(r.user.id, id, d.body); }
};
exports.WallController = WallController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('before')),
    __param(2, (0, common_1.Query)('authorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], WallController.prototype, "feed", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, wall_dto_1.CreateWallPostDto]),
    __metadata("design:returntype", void 0)
], WallController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, wall_dto_1.UpdateWallPostDto]),
    __metadata("design:returntype", void 0)
], WallController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WallController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/like'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WallController.prototype, "like", null);
__decorate([
    (0, common_1.Post)(':id/comments'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, wall_dto_1.CreateWallCommentDto]),
    __metadata("design:returntype", void 0)
], WallController.prototype, "comment", null);
exports.WallController = WallController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtGuard),
    (0, common_1.Controller)('wall'),
    __metadata("design:paramtypes", [wall_service_1.WallService])
], WallController);
//# sourceMappingURL=wall.controller.js.map