export declare class MediaAsset {
    id: string;
    ownerId: string;
    purpose: 'avatar' | 'cover' | 'gallery' | 'wall' | 'room' | 'dm';
    storageKey: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    attachedKind: string | null;
    attachedId: string | null;
    attachedAt: Date | null;
    createdAt: Date;
    deletedAt: Date | null;
}
