export declare class UpdateRoomDto {
    name?: string;
    description?: string;
    isLocked?: boolean;
    maxMembers?: number;
    maxMicrophones?: number;
}
export declare class UpdateRankDto {
    name?: string;
    starColor?: string;
    icon?: string;
    microphoneDuration?: number;
    permissions?: Record<string, boolean>;
}
export declare class SetUserRankDto {
    starCount: number;
}
export declare class UpdateSettingDto {
    key: string;
    value: unknown;
}
export declare class AdminContentQueryDto {
    q?: string;
    limit?: number;
}
