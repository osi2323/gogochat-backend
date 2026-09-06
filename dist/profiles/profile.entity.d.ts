import { User } from '../auth/user.entity';
export declare class Profile {
    userId: string;
    user: User;
    displayName: string | null;
    city: string | null;
    country: string | null;
    bio: string | null;
    avatarUrl: string | null;
    avatarAssetId: string | null;
    coverUrl: string | null;
    coverAssetId: string | null;
    interests: string[];
    photoUrls: string[];
}
