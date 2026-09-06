export declare class WallPost {
    id: string;
    authorId: string;
    body: string;
    mediaAssetId: string | null;
    createdAt: Date;
    updatedAt: Date | null;
    deletedAt: Date | null;
}
export declare class WallComment {
    id: string;
    postId: string;
    authorId: string;
    body: string;
    createdAt: Date;
}
export declare class WallLike {
    postId: string;
    userId: string;
    createdAt: Date;
}
