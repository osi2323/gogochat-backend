export declare class Friendship {
    id: string;
    requesterId: string;
    addresseeId: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
    updatedAt: Date;
}
