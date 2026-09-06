import { EntityManager, Repository } from 'typeorm';
import { MediaAsset } from './media.entity';
type Purpose = MediaAsset['purpose'];
export declare class MediaService {
    private repo;
    constructor(repo: Repository<MediaAsset>);
    private cfg;
    upload(userId: string, purpose: Purpose, file: Express.Multer.File): Promise<MediaAsset>;
    claim(manager: EntityManager, userId: string, id: string, purpose: Purpose, kind: string, attachedId: string): Promise<MediaAsset>;
    remove(userId: string, id: string): Promise<{
        ok: boolean;
    }>;
    removeObject(path: string): Promise<void>;
}
export {};
