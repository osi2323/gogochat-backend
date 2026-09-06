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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Profile = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../auth/user.entity");
let Profile = class Profile {
    userId;
    user;
    displayName;
    city;
    country;
    bio;
    avatarUrl;
    avatarAssetId;
    coverUrl;
    coverAssetId;
    interests;
    photoUrls;
};
exports.Profile = Profile;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid', { name: 'user_id' }),
    __metadata("design:type", String)
], Profile.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], Profile.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'display_name', length: 64, nullable: true }),
    __metadata("design:type", Object)
], Profile.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 80, nullable: true }),
    __metadata("design:type", Object)
], Profile.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 80, nullable: true }),
    __metadata("design:type", Object)
], Profile.prototype, "country", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], Profile.prototype, "bio", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'avatar_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Profile.prototype, "avatarUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'avatar_asset_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Profile.prototype, "avatarAssetId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cover_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Profile.prototype, "coverUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cover_asset_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Profile.prototype, "coverAssetId", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { array: true, default: '{}' }),
    __metadata("design:type", Array)
], Profile.prototype, "interests", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { name: 'photo_urls', array: true, default: '{}' }),
    __metadata("design:type", Array)
], Profile.prototype, "photoUrls", void 0);
exports.Profile = Profile = __decorate([
    (0, typeorm_1.Entity)('profiles')
], Profile);
//# sourceMappingURL=profile.entity.js.map