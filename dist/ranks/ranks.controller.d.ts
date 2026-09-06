import { RanksService } from './ranks.service';
export declare class RanksController {
    private readonly ranks;
    constructor(ranks: RanksService);
    list(): Promise<import("./rank.entity").Rank[]>;
}
