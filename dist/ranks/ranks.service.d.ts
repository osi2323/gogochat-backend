import { Repository } from 'typeorm';
import { Rank } from './rank.entity';
export declare class RanksService {
    private readonly repo;
    constructor(repo: Repository<Rank>);
    list(): Promise<Rank[]>;
    byStars(stars: number): Promise<Rank>;
}
