import { RoomsService } from './rooms.service';
export declare class RoomsController {
    private readonly rooms;
    constructor(rooms: RoomsService);
    list(): Promise<import("./room.entity").Room[]>;
}
