import { Rank } from '../ranks/rank.entity';
export declare class User {
    id: string;
    username: string;
    passwordHash: string | null;
    isGuest: boolean;
    rankId: string;
    rank: Rank;
}
