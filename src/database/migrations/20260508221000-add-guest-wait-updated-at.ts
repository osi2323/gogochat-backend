import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuestWaitUpdatedAt20260508221000
  implements MigrationInterface
{
  name = 'AddGuestWaitUpdatedAt20260508221000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "guestWaitUpdatedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "guestWaitUpdatedAt"
    `);
  }
}
