import { Injectable } from '@nestjs/common';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get<string>('database.host'),
      port: this.configService.get<number>('database.port'),
      username: this.configService.get<string>('database.username'),
      password: this.configService.get<string>('database.password'),
      database: this.configService.get<string>('database.name'),
      schema: this.configService.get<string>('database.schema'),
      autoLoadEntities: true,
      synchronize: this.configService.get<boolean>(
        'database.synchronize',
        false,
      ),
      ssl: this.configService.get<boolean>('database.ssl', false)
        ? { rejectUnauthorized: false }
        : false,
      extra: this.configService.get('database.extra'),
    } as DataSourceOptions;
  }
}
