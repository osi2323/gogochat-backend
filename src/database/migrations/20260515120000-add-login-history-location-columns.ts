import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoginHistoryLocationColumns20260515120000
  implements MigrationInterface
{
  name = 'AddLoginHistoryLocationColumns20260515120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "login_history"
        ADD COLUMN IF NOT EXISTS "locationCity" character varying(255),
        ADD COLUMN IF NOT EXISTS "locationDistrict" character varying(255),
        ADD COLUMN IF NOT EXISTS "locationCountry" character varying(255),
        ADD COLUMN IF NOT EXISTS "locationCountryCode" character varying(10),
        ADD COLUMN IF NOT EXISTS "locationIsp" character varying(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "login_history"
        DROP COLUMN IF EXISTS "locationIsp",
        DROP COLUMN IF EXISTS "locationCountryCode",
        DROP COLUMN IF EXISTS "locationCountry",
        DROP COLUMN IF EXISTS "locationDistrict",
        DROP COLUMN IF EXISTS "locationCity"
    `);
  }
}
