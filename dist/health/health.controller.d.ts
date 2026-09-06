import { DataSource } from 'typeorm';
export declare class HealthController {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    live(): {
        ok: boolean;
        service: string;
        timestamp: string;
    };
    ready(): Promise<{
        ok: boolean;
        service: string;
        database: string;
        timestamp: string;
    }>;
}
