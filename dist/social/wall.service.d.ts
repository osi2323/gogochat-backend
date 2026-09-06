import { DataSource, Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MediaService } from '../media/media.service';
import { MediaAsset } from '../media/media.entity';
import { Follow } from './follow.entity';
import { WallComment, WallLike, WallPost } from './wall.entity';
import { SiteConfigService } from '../site-config/site-config.service';
export declare class WallService {
    private posts;
    private comments;
    private likes;
    private users;
    private follows;
    private notifications;
    private db;
    private media;
    private siteConfig;
    constructor(posts: Repository<WallPost>, comments: Repository<WallComment>, likes: Repository<WallLike>, users: Repository<User>, follows: Repository<Follow>, notifications: NotificationsService, db: DataSource, media: MediaService, siteConfig: SiteConfigService);
    private decorate;
    feed(viewerId: string, before?: string, authorId?: string): Promise<{
        items: {
            id: string;
            body: string;
            media: MediaAsset | null;
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
    create(actorId: string, body: string, mediaAssetId?: string): Promise<{
        id: string;
        body: string;
        media: MediaAsset | null;
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
    update(actorId: string, postId: string, body: string): Promise<{
        id: string;
        body: string;
        media: MediaAsset | null;
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
    remove(actorId: string, postId: string): Promise<{
        ok: boolean;
        id: string;
    }>;
    toggleLike(actorId: string, postId: string): Promise<{
        liked: boolean;
        count: number;
    }>;
    comment(actorId: string, postId: string, body: string): Promise<{
        id: string;
        body: string;
        createdAt: Date;
        author: any;
    }>;
}
