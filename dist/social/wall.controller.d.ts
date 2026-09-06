import { CreateWallCommentDto, CreateWallPostDto, UpdateWallPostDto } from './wall.dto';
import { WallService } from './wall.service';
export declare class WallController {
    private w;
    constructor(w: WallService);
    feed(r: any, before?: string, authorId?: string): Promise<{
        items: {
            id: string;
            body: string;
            media: import("../media/media.entity").MediaAsset | null;
            createdAt: Date;
            author: any;
            likeCount: number;
            likedByMe: boolean;
            comments: {
                id: string;
                body: string;
                createdAt: Date;
                author: any;
            }[];
        }[];
        nextCursor: string | null;
    }>;
    create(r: any, d: CreateWallPostDto): Promise<{
        id: string;
        body: string;
        media: import("../media/media.entity").MediaAsset | null;
        createdAt: Date;
        author: any;
        likeCount: number;
        likedByMe: boolean;
        comments: {
            id: string;
            body: string;
            createdAt: Date;
            author: any;
        }[];
    }>;
    update(r: any, id: string, d: UpdateWallPostDto): Promise<{
        id: string;
        body: string;
        media: import("../media/media.entity").MediaAsset | null;
        createdAt: Date;
        author: any;
        likeCount: number;
        likedByMe: boolean;
        comments: {
            id: string;
            body: string;
            createdAt: Date;
            author: any;
        }[];
    }>;
    remove(r: any, id: string): Promise<{
        ok: boolean;
        id: string;
    }>;
    like(r: any, id: string): Promise<{
        liked: boolean;
        count: number;
    }>;
    comment(r: any, id: string, d: CreateWallCommentDto): Promise<{
        id: string;
        body: string;
        createdAt: Date;
        author: any;
    }>;
}
