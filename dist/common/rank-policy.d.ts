import { User } from '../auth/user.entity';
export declare function assertCanAct(actor: User, target: User, permission: string): void;
export declare function assertCanGrantRank(actor: User, target: User, nextStars: number): void;
