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
exports.DirectMessage = exports.DirectConversationMember = exports.DirectConversation = void 0;
const typeorm_1 = require("typeorm");
let DirectConversation = class DirectConversation {
    id;
    pairKey;
    createdAt;
    updatedAt;
};
exports.DirectConversation = DirectConversation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DirectConversation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pair_key', length: 73, unique: true }),
    __metadata("design:type", String)
], DirectConversation.prototype, "pairKey", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DirectConversation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], DirectConversation.prototype, "updatedAt", void 0);
exports.DirectConversation = DirectConversation = __decorate([
    (0, typeorm_1.Entity)('direct_conversations')
], DirectConversation);
let DirectConversationMember = class DirectConversationMember {
    conversationId;
    userId;
    lastReadAt;
    lastReadMessageId;
};
exports.DirectConversationMember = DirectConversationMember;
__decorate([
    (0, typeorm_1.Column)('uuid', { primary: true, name: 'conversation_id' }),
    __metadata("design:type", String)
], DirectConversationMember.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { primary: true, name: 'user_id' }),
    __metadata("design:type", String)
], DirectConversationMember.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { name: 'last_read_at', nullable: true }),
    __metadata("design:type", Object)
], DirectConversationMember.prototype, "lastReadAt", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { name: 'last_read_message_id', nullable: true }),
    __metadata("design:type", Object)
], DirectConversationMember.prototype, "lastReadMessageId", void 0);
exports.DirectConversationMember = DirectConversationMember = __decorate([
    (0, typeorm_1.Entity)('direct_conversation_members')
], DirectConversationMember);
let DirectMessage = class DirectMessage {
    id;
    conversationId;
    senderId;
    clientId;
    body;
    mediaAssetId;
    createdAt;
    editedAt;
    deletedAt;
};
exports.DirectMessage = DirectMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DirectMessage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { name: 'conversation_id' }),
    __metadata("design:type", String)
], DirectMessage.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { name: 'sender_id' }),
    __metadata("design:type", String)
], DirectMessage.prototype, "senderId", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { name: 'client_id' }),
    __metadata("design:type", String)
], DirectMessage.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 4000, default: '' }),
    __metadata("design:type", String)
], DirectMessage.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { name: 'media_asset_id', nullable: true }),
    __metadata("design:type", Object)
], DirectMessage.prototype, "mediaAssetId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DirectMessage.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { name: 'edited_at', nullable: true }),
    __metadata("design:type", Object)
], DirectMessage.prototype, "editedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { name: 'deleted_at', nullable: true }),
    __metadata("design:type", Object)
], DirectMessage.prototype, "deletedAt", void 0);
exports.DirectMessage = DirectMessage = __decorate([
    (0, typeorm_1.Entity)('direct_messages')
], DirectMessage);
//# sourceMappingURL=dm.entity.js.map