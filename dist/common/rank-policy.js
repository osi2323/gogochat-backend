"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCanAct = assertCanAct;
exports.assertCanGrantRank = assertCanGrantRank;
const common_1 = require("@nestjs/common");
function assertCanAct(actor, target, permission) { if (!actor.rank?.permissions?.[permission])
    throw new common_1.ForbiddenException('Bu işlem için yetkin yok.'); if (actor.id === target.id)
    throw new common_1.ForbiddenException('Kendi hesabına bu işlemi uygulayamazsın.'); if (actor.rank.starCount <= target.rank.starCount)
    throw new common_1.ForbiddenException('Eşit veya daha yüksek rütbeye işlem uygulanamaz.'); }
function assertCanGrantRank(actor, target, nextStars) { assertCanAct(actor, target, 'admin.users'); if (nextStars >= actor.rank.starCount)
    throw new common_1.ForbiddenException('Kendi rütbene eşit veya daha yüksek rütbe veremezsin.'); if (nextStars === 27)
    throw new common_1.ForbiddenException('⭐27 Site Sahibi korumalıdır.'); }
//# sourceMappingURL=rank-policy.js.map