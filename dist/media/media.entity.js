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
exports.MediaAsset = void 0;
const typeorm_1 = require("typeorm");
let MediaAsset = class MediaAsset {
    id;
    ownerId;
    purpose;
    storageKey;
    publicUrl;
    mimeType;
    sizeBytes;
    attachedKind;
    attachedId;
    attachedAt;
    createdAt;
    deletedAt;
};
exports.MediaAsset = MediaAsset;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MediaAsset.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'owner_id', type: 'uuid' }),
    __metadata("design:type", String)
], MediaAsset.prototype, "ownerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 24 }),
    __metadata("design:type", String)
], MediaAsset.prototype, "purpose", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'storage_key', type: 'text', unique: true }),
    __metadata("design:type", String)
], MediaAsset.prototype, "storageKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'public_url', type: 'text' }),
    __metadata("design:type", String)
], MediaAsset.prototype, "publicUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type', length: 80 }),
    __metadata("design:type", String)
], MediaAsset.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_bytes', type: 'int' }),
    __metadata("design:type", Number)
], MediaAsset.prototype, "sizeBytes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'attached_kind', length: 24, nullable: true }),
    __metadata("design:type", Object)
], MediaAsset.prototype, "attachedKind", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'attached_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], MediaAsset.prototype, "attachedId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'attached_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], MediaAsset.prototype, "attachedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MediaAsset.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', nullable: true }),
    __metadata("design:type", Object)
], MediaAsset.prototype, "deletedAt", void 0);
exports.MediaAsset = MediaAsset = __decorate([
    (0, typeorm_1.Entity)('media_assets')
], MediaAsset);
//# sourceMappingURL=media.entity.js.map