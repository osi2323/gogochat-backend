import type { Request, Response, NextFunction } from 'express';
export declare function apiSecurityHeaders(_req: Request, res: Response, next: NextFunction): void;
export declare function parseCorsOrigins(raw?: string): string[];
