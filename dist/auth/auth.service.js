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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const jwt_1 = require("@nestjs/jwt");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcryptjs");
const node_crypto_1 = require("node:crypto");
const user_entity_1 = require("./user.entity");
const rank_entity_1 = require("../ranks/rank.entity");
const auth_session_entity_1 = require("./auth-session.entity");
const site_config_service_1 = require("../site-config/site-config.service");
let AuthService = class AuthService {
    users;
    ranks;
    sessions;
    jwt;
    siteConfig;
    db;
    constructor(users, ranks, sessions, jwt, siteConfig, db) {
        this.users = users;
        this.ranks = ranks;
        this.sessions = sessions;
        this.jwt = jwt;
        this.siteConfig = siteConfig;
        this.db = db;
    }
    publicUser(user) { return { id: user.id, username: user.username, isGuest: user.isGuest, rank: user.rank }; }
    hash(raw) { return (0, node_crypto_1.createHash)('sha256').update(raw).digest('hex'); }
    async access(user) { return this.jwt.signAsync({ sub: user.id, username: user.username }, { expiresIn: '15m' }); }
    makeRefresh() { const refreshToken = (0, node_crypto_1.randomBytes)(48).toString('base64url'); return { refreshToken, tokenHash: this.hash(refreshToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }; }
    async issue(user, meta) { const r = this.makeRefresh(); const session = this.sessions.create({ userId: user.id, tokenHash: r.tokenHash, expiresAt: r.expiresAt, revokedAt: null, lastUsedAt: null, userAgent: meta?.userAgent?.slice(0, 300) || null, ipAddress: meta?.ip?.slice(0, 64) || null }); await this.sessions.save(session); return { accessToken: await this.access(user), refreshToken: r.refreshToken, refreshExpiresAt: r.expiresAt, user: this.publicUser(user) }; }
    async register(username, password, meta) { if (await this.users.exists({ where: { username } }))
        throw new common_1.BadRequestException('Bu kullanıcı adı kullanımda'); const rank = await this.ranks.findOneByOrFail({ starCount: 1 }); const user = this.users.create({ username, passwordHash: await bcrypt.hash(password, 12), isGuest: false, rankId: rank.id, rank }); await this.users.save(user); return this.issue(user, meta); }
    async login(username, password, meta) { const user = await this.users.findOne({ where: { username }, relations: { rank: true } }); if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash)))
        throw new common_1.UnauthorizedException('Kullanıcı adı veya parola hatalı'); return this.issue(user, meta); }
    async guest(nickname, meta) { if (!await this.siteConfig.enabled('guest.enabled', true))
        throw new common_1.BadRequestException('Misafir girişi şu anda kapalı'); const rank = await this.ranks.findOneByOrFail({ starCount: 1 }); const suffix = (0, node_crypto_1.randomBytes)(4).toString('hex').slice(0, 5); const user = this.users.create({ username: `${nickname}-${suffix}`.slice(0, 32), passwordHash: null, isGuest: true, rankId: rank.id, rank }); await this.users.save(user); return this.issue(user, meta); }
    async refresh(raw, meta) { if (!raw)
        throw new common_1.UnauthorizedException('Oturum bulunamadı'); const tokenHash = this.hash(raw); const rotated = await this.db.transaction(async (em) => { const repo = em.getRepository(auth_session_entity_1.AuthSession); const session = await repo.createQueryBuilder('s').setLock('pessimistic_write').leftJoinAndSelect('s.user', 'user').leftJoinAndSelect('user.rank', 'rank').where('s.token_hash=:tokenHash', { tokenHash }).getOne(); if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now())
        throw new common_1.UnauthorizedException('Oturum süresi dolmuş'); const now = new Date(); session.revokedAt = now; session.lastUsedAt = now; await repo.save(session); const r = this.makeRefresh(); await repo.save(repo.create({ userId: session.userId, tokenHash: r.tokenHash, expiresAt: r.expiresAt, revokedAt: null, lastUsedAt: null, userAgent: meta?.userAgent?.slice(0, 300) || null, ipAddress: meta?.ip?.slice(0, 64) || null })); return { user: session.user, ...r }; }); return { accessToken: await this.access(rotated.user), refreshToken: rotated.refreshToken, refreshExpiresAt: rotated.expiresAt, user: this.publicUser(rotated.user) }; }
    async logout(raw) { if (!raw)
        return { ok: true }; const session = await this.sessions.findOneBy({ tokenHash: this.hash(raw) }); if (session && !session.revokedAt) {
        session.revokedAt = new Date();
        await this.sessions.save(session);
    } return { ok: true }; }
    async me(id) { const user = await this.users.findOne({ where: { id }, relations: { rank: true } }); if (!user)
        throw new common_1.UnauthorizedException(); return this.publicUser(user); }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(rank_entity_1.Rank)),
    __param(2, (0, typeorm_1.InjectRepository)(auth_session_entity_1.AuthSession)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeorm_2.Repository, typeorm_2.Repository, jwt_1.JwtService, site_config_service_1.SiteConfigService, typeorm_2.DataSource])
], AuthService);
//# sourceMappingURL=auth.service.js.map