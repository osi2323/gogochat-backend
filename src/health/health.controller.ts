import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('live')
  live() {
    return {
      ok: true,
      service: 'gogochat-v4-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        ok: true,
        service: 'gogochat-v4-backend',
        database: 'ready',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        service: 'gogochat-v4-backend',
        database: 'unavailable',
      });
    }
  }
}
