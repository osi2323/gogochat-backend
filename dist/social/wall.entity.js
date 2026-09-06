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
exports.WallLike = exports.WallComment = exports.WallPost = void 0;
const typeorm_1 = require("typeorm");
let WallPost = class WallPost {
    id;
    authorId;
    body;
    mediaAssetId;
    createdAt;
    updatedAt;
    deletedAt;
};
exports.WallPost = WallPost;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WallPost.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'author_id' }),
    __metadata("design:type", String)
], WallPost.prototype, "authorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 2000, default: '' }),
    __metadata("design:type", String)
], WallPost.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'media_asset_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], WallPost.prototype, "mediaAssetId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], WallPost.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', nullable: true }),
    __metadata("design:type", Object)
], WallPost.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', nullable: true }),
    __metadata("design:type", Object)
], WallPost.prototype, "deletedAt", void 0);
exports.WallPost = WallPost = __decorate([
    (0, typeorm_1.Entity)('wall_posts')
], WallPost);
let WallComment = class WallComment {
    id;
    postId;
    authorId;
    body;
    createdAt;
};
exports.WallComment = WallComment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WallComment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'post_id' }),
    __metadata("design:type", String)
], WallComment.prototype, "postId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'author_id' }),
    __metadata("design:type", String)
], WallComment.prototype, "authorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000 }),
    __metadata("design:type", String)
], WallComment.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], WallComment.prototype, "createdAt", void 0);
exports.WallComment = WallComment = __decorate([
    (0, typeorm_1.Entity)('wall_comments')
], WallComment);
let WallLike = class WallLike {
    postId;
    userId;
    createdAt;
};
exports.WallLike = WallLike;
__decorate([
    (0, typeorm_1.Column)({ primary: true, name: 'post_id', type: 'uuid' }),
    __metadata("design:type", String)
], WallLike.prototype, "postId", void 0);
__decorate([
    (0, typeorm_1.Column)({ primary: true, name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], WallLike.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], WallLike.prototype, "createdAt", void 0);
exports.WallLike = WallLike = __decorate([
    (0, typeorm_1.Entity)('wall_likes')
], WallLike);
//# sourceMappingURL=wall.entity.js.map