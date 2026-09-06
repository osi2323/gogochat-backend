import { Repository } from 'typeorm';
import { Room } from './room.entity';
export declare class RoomsService {
    private readonly repo;
    constructor(repo: Repository<Room>);
    list(): Promise<Room[]>;
}
