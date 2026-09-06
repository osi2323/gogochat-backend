import { DataSource, Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { Profile } from '../profiles/profile.entity';
import { Follow } from './follow.entity';
import { Friendship } from './friendship.entity';
import { UpdateProfileDto } from './profile.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { MediaService } from '../media/media.service';
export declare class SocialService {
    private users;
    private profiles;
    private follows;
    private friendships;
    private db;
    private notifications;
    private media;
    constructor(users: Repository<User>, profiles: Repository<Profile>, follows: Repository<Follow>, friendships: Repository<Friendship>, db: DataSource, notifications: NotificationsService, media: MediaService);
    profile(userId: string): Promise<{
        user: {
            id: string;
            username: string;
            isGuest: boolean;
            rank: import("../ranks/rank.entity").Rank;
        };
        profile: Profile | {
            userId: string;
            displayName: null;
            city: null;
            country: null;
            bio: null;
            avatarUrl: null;
            coverUrl: null;
            interests: never[];
        };
        stats: {
            followers: number;
            following: number;
        };
        gallery: any;
    }>;
    updateProfile(actorId: string, d: UpdateProfileDto): Promise<{
        user: {
            id: string;
            username: string;
            isGuest: boolean;
            rank: import("../ranks/rank.entity").Rank;
        };
        profile: Profile | {
            userId: string;
            displayName: null;
            city: null;
            country: null;
            bio: null;
            avatarUrl: null;
            coverUrl: null;
            interests: never[];
        };
        stats: {
            followers: number;
            following: number;
        };
        gallery: any;
    }>;
    setProfileMedia(actorId: string, purpose: 'avatar' | 'cover', assetId: string): Promise<{
        assetId: string;
        url: string;
    }>;
    addGallery(actorId: string, assetId: string): Promise<{
        id: string;
        publicUrl: string;
        mimeType: string;
        position: number;
    }>;
    removeGallery(actorId: string, assetId: string): Promise<{
        ok: boolean;
    }>;
    toggleFollow(actorId: string, targetId: string): Promise<{
        following: boolean;
    }>;
    requestFriend(actorId: string, targetId: string): Promise<Friendship>;
    respond(actorId: string, id: string, accept: boolean): Promise<Friendship>;
    friendshipState(actorId: string, targetId: string): Promise<{
        status: "self";
        requestId: null;
        incoming: boolean;
    } | {
        status: "none";
        requestId: null;
        incoming: boolean;
    } | {
        status: "pending" | "accepted" | "rejected";
        requestId: string;
        incoming: boolean;
    }>;
    pendingRequests(actorId: string): Promise<{
        id: string;
        createdAt: Date;
        user: any;
    }[]>;
    discover(actorId: string, q?: string): Promise<{
        id: any;
        username: any;
        isGuest: any;
        rank: any;
        profile: any;
    }[]>;
    friends(actorId: string): Promise<User[]>;
}
