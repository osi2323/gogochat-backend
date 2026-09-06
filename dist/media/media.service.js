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
exports.MediaService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const node_crypto_1 = require("node:crypto");
const media_entity_1 = require("./media.entity");
const IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
function sniff(b) { if (b.length < 12)
    return null; if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return 'image/jpeg'; if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png'; if (b.subarray(0, 4).toString() === 'GIF8')
    return 'image/gif'; if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp'; if (b.subarray(4, 8).toString() === 'ftyp')
    return 'video/mp4'; return null; }
let MediaService = class MediaService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    cfg() { const url = process.env.SUPABASE_URL?.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_ROLE_KEY; const bucket = process.env.SUPABASE_MEDIA_BUCKET || 'gogochat-media'; if (!url || !key)
        throw new common_1.BadRequestException('Media storage yapılandırılmamış'); return { url, key, bucket }; }
    async upload(userId, purpose, file) { if (!file?.buffer?.length)
        throw new common_1.BadRequestException('Dosya gerekli'); const mime = sniff(file.buffer); if (!mime)
        throw new common_1.BadRequestException('Desteklenmeyen veya geçersiz dosya'); if (['avatar', 'cover', 'gallery'].includes(purpose) && !IMAGE.has(mime))
        throw new common_1.BadRequestException('Bu alanda yalnız görsel kullanılabilir'); if (!IMAGE.has(mime) && mime !== 'video/mp4')
        throw new common_1.BadRequestException('Dosya türü desteklenmiyor'); const max = IMAGE.has(mime) ? 8 * 1024 * 1024 : 15 * 1024 * 1024; if (file.size > max)
        throw new common_1.BadRequestException(`Dosya en fazla ${IMAGE.has(mime) ? 8 : 15} MB olabilir`); const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4' }; const path = `users/${userId}/${purpose}/${(0, node_crypto_1.randomUUID)()}.${ext[mime]}`; const c = this.cfg(); const r = await fetch(`${c.url}/storage/v1/object/${c.bucket}/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${c.key}`, apikey: c.key, 'Content-Type': mime, 'x-upsert': 'false' }, body: new Uint8Array(file.buffer) }); if (!r.ok)
        throw new common_1.BadRequestException('Dosya depolamaya yüklenemedi'); const publicUrl = `${c.url}/storage/v1/object/public/${c.bucket}/${path}`; try {
        return await this.repo.save(this.repo.create({ ownerId: userId, purpose, storageKey: path, publicUrl, mimeType: mime, sizeBytes: file.size, attachedKind: null, attachedId: null, attachedAt: null }));
    }
    catch (e) {
        await this.removeObject(path).catch(() => undefined);
        throw e;
    } }
    async claim(manager, userId, id, purpose, kind, attachedId) { const repo = manager.getRepository(media_entity_1.MediaAsset); const a = await repo.createQueryBuilder('a').setLock('pessimistic_write').where('a.id=:id AND a.deletedAt IS NULL', { id }).getOne(); if (!a)
        throw new common_1.NotFoundException('Medya bulunamadı'); if (a.ownerId !== userId)
        throw new common_1.ForbiddenException('Bu medya sana ait değil'); if (a.purpose !== purpose)
        throw new common_1.BadRequestException('Medya amacı uyuşmuyor'); if (a.attachedId)
        throw new common_1.BadRequestException('Medya zaten kullanılıyor'); a.attachedKind = kind; a.attachedId = attachedId; a.attachedAt = new Date(); return repo.save(a); }
    async remove(userId, id) { const a = await this.repo.findOne({ where: { id } }); if (!a)
        throw new common_1.NotFoundException('Medya bulunamadı'); if (a.ownerId !== userId)
        throw new common_1.ForbiddenException(); if (a.attachedId)
        throw new common_1.BadRequestException('Kullanımdaki medya doğrudan silinemez'); await this.removeObject(a.storageKey); await this.repo.softDelete(id); return { ok: true }; }
    async removeObject(path) { const c = this.cfg(); const r = await fetch(`${c.url}/storage/v1/object/${c.bucket}/${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${c.key}`, apikey: c.key } }); if (!r.ok && r.status !== 404)
        throw new Error('storage delete failed'); }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(media_entity_1.MediaAsset)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], MediaService);
//# sourceMappingURL=media.service.js.map