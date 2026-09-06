import { MediaService } from './media.service';
export declare class MediaController {
    private media;
    constructor(media: MediaService);
    upload(req: any, purpose: string, file: Express.Multer.File): Promise<import("./media.entity").MediaAsset>;
    remove(req: any, id: string): Promise<{
        ok: boolean;
    }>;
}
