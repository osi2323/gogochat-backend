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
exports.SocialController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const social_service_1 = require("./social.service");
const profile_dto_1 = require("./profile.dto");
const social_dto_1 = require("./social.dto");
const profile_media_dto_1 = require("./profile-media.dto");
let SocialController = class SocialController {
    s;
    constructor(s) {
        this.s = s;
    }
    avatar(r, d) { return this.s.setProfileMedia(r.user.id, 'avatar', d.mediaAssetId); }
    cover(r, d) { return this.s.setProfileMedia(r.user.id, 'cover', d.mediaAssetId); }
    galleryAdd(r, d) { return this.s.addGallery(r.user.id, d.mediaAssetId); }
    galleryRemove(r, id) { return this.s.removeGallery(r.user.id, id); }
    profile(id) { return this.s.profile(id); }
    update(r, d) { return this.s.updateProfile(r.user.id, d); }
    follow(r, id) { return this.s.toggleFollow(r.user.id, id); }
    friend(r, id) { return this.s.requestFriend(r.user.id, id); }
    respond(r, id, d) { return this.s.respond(r.user.id, id, d.accept); }
    state(r, id) { return this.s.friendshipState(r.user.id, id); }
    requests(r) { return this.s.pendingRequests(r.user.id); }
    discover(r, q) { return this.s.discover(r.user.id, q); }
    friends(r) { return this.s.friends(r.user.id); }
};
exports.SocialController = SocialController;
__decorate([
    (0, common_1.Post)('profiles/me/avatar'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, profile_media_dto_1.ProfileMediaDto]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "avatar", null);
__decorate([
    (0, common_1.Post)('profiles/me/cover'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, profile_media_dto_1.ProfileMediaDto]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "cover", null);
__decorate([
    (0, common_1.Post)('profiles/me/gallery'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, profile_media_dto_1.ProfileMediaDto]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "galleryAdd", null);
__decorate([
    (0, common_1.Delete)('profiles/me/gallery/:assetId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('assetId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "galleryRemove", null);
__decorate([
    (0, common_1.Get)('profiles/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "profile", null);
__decorate([
    (0, common_1.Patch)('profiles/me'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, profile_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('social/follow/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "follow", null);
__decorate([
    (0, common_1.Post)('social/friends/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "friend", null);
__decorate([
    (0, common_1.Post)('social/friends/request/:id/respond'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, social_dto_1.FriendResponseDto]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "respond", null);
__decorate([
    (0, common_1.Get)('social/friends/state/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "state", null);
__decorate([
    (0, common_1.Get)('social/friends/requests'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "requests", null);
__decorate([
    (0, common_1.Get)('social/discover'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "discover", null);
__decorate([
    (0, common_1.Get)('social/friends'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "friends", null);
exports.SocialController = SocialController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [social_service_1.SocialService])
], SocialController);
//# sourceMappingURL=social.controller.js.map