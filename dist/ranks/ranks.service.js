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
exports.RanksService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const rank_entity_1 = require("./rank.entity");
let RanksService = class RanksService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    list() { return this.repo.find({ order: { starCount: 'ASC' } }); }
    async byStars(stars) { if (stars < 1 || stars > 27)
        throw new common_1.BadRequestException('Rütbe 1-27 arasında olmalı.'); return this.repo.findOneByOrFail({ starCount: stars }); }
};
exports.RanksService = RanksService;
exports.RanksService = RanksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(rank_entity_1.Rank)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], RanksService);
//# sourceMappingURL=ranks.service.js.map