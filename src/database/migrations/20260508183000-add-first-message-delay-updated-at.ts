import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFirstMessageDelayUpdatedAt20260508183000
  implements MigrationInterface
{
  name = 'AddFirstMessageDelayUpdatedAt20260508183000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "firstMessageDelayUpdatedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "firstMessageDelayUpdatedAt"
    `);
  }
}
