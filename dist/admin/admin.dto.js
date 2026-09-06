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
exports.AdminContentQueryDto = exports.UpdateSettingDto = exports.SetUserRankDto = exports.UpdateRankDto = exports.UpdateRoomDto = void 0;
const class_validator_1 = require("class-validator");
class UpdateRoomDto {
    name;
    description;
    isLocked;
    maxMembers;
    maxMicrophones;
}
exports.UpdateRoomDto = UpdateRoomDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 48),
    __metadata("design:type", String)
], UpdateRoomDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 180),
    __metadata("design:type", String)
], UpdateRoomDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateRoomDto.prototype, "isLocked", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(2),
    (0, class_validator_1.Max)(5000),
    __metadata("design:type", Number)
], UpdateRoomDto.prototype, "maxMembers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], UpdateRoomDto.prototype, "maxMicrophones", void 0);
class UpdateRankDto {
    name;
    starColor;
    icon;
    microphoneDuration;
    permissions;
}
exports.UpdateRankDto = UpdateRankDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 40),
    __metadata("design:type", String)
], UpdateRankDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 20),
    __metadata("design:type", String)
], UpdateRankDto.prototype, "starColor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 16),
    __metadata("design:type", String)
], UpdateRankDto.prototype, "icon", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(30),
    (0, class_validator_1.Max)(86400),
    __metadata("design:type", Number)
], UpdateRankDto.prototype, "microphoneDuration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateRankDto.prototype, "permissions", void 0);
class SetUserRankDto {
    starCount;
}
exports.SetUserRankDto = SetUserRankDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(27),
    __metadata("design:type", Number)
], SetUserRankDto.prototype, "starCount", void 0);
class UpdateSettingDto {
    key;
    value;
}
exports.UpdateSettingDto = UpdateSettingDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 80),
    __metadata("design:type", String)
], UpdateSettingDto.prototype, "key", void 0);
class AdminContentQueryDto {
    q;
    limit;
}
exports.AdminContentQueryDto = AdminContentQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 80),
    __metadata("design:type", String)
], AdminContentQueryDto.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], AdminContentQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=admin.dto.js.map