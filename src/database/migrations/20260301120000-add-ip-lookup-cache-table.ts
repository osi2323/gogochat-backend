import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIpLookupCacheTable20260301120000
  implements MigrationInterface
{
  name = 'AddIpLookupCacheTable20260301120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ip_lookup_cache" (
        "id" SERIAL NOT NULL,
        "ipAddress" character varying(45) NOT NULL,
        "countryCode" character varying(10),
        "country" character varying(255),
        "regionName" character varying(255),
        "city" character varying(255),
        "district" character varying(255),
        "isp" character varying(255),
        "rawResponse" jsonb,
        "fetchedAt" TIMESTAMP NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        CONSTRAINT "UQ_ip_lookup_cache_ipAddress" UNIQUE ("ipAddress"),
        CONSTRAINT "PK_ip_lookup_cache_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ip_lookup_cache"`);
  }
}
