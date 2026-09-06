import { SocialService } from './social.service';
import { UpdateProfileDto } from './profile.dto';
import { FriendResponseDto } from './social.dto';
import { ProfileMediaDto } from './profile-media.dto';
export declare class SocialController {
    private s;
    constructor(s: SocialService);
    avatar(r: any, d: ProfileMediaDto): Promise<{
        assetId: string;
        url: string;
    }>;
    cover(r: any, d: ProfileMediaDto): Promise<{
        assetId: string;
        url: string;
    }>;
    galleryAdd(r: any, d: ProfileMediaDto): Promise<{
        id: string;
        publicUrl: string;
        mimeType: string;
        position: number;
    }>;
    galleryRemove(r: any, id: string): Promise<{
        ok: boolean;
    }>;
    profile(id: string): Promise<{
        user: {
            id: string;
            username: string;
            isGuest: boolean;
            rank: import("../ranks/rank.entity").Rank;
        };
        profile: import("../profiles/profile.entity").Profile | {
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
    update(r: any, d: UpdateProfileDto): Promise<{
        user: {
            id: string;
            username: string;
            isGuest: boolean;
            rank: import("../ranks/rank.entity").Rank;
        };
        profile: import("../profiles/profile.entity").Profile | {
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
    follow(r: any, id: string): Promise<{
        following: boolean;
    }>;
    friend(r: any, id: string): Promise<import("./friendship.entity").Friendship>;
    respond(r: any, id: string, d: FriendResponseDto): Promise<import("./friendship.entity").Friendship>;
    state(r: any, id: string): Promise<{
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
    requests(r: any): Promise<{
        id: string;
        createdAt: Date;
        user: any;
    }[]>;
    discover(r: any, q?: string): Promise<{
        id: any;
        username: any;
        isGuest: any;
        rank: any;
        profile: any;
    }[]>;
    friends(r: any): Promise<import("../auth/user.entity").User[]>;
}
