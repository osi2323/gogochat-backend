import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBotModerationColumns20260301150000
  implements MigrationInterface
{
  name = 'AddBotModerationColumns20260301150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bots"
      ADD COLUMN IF NOT EXISTS "roomMuted" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "bots"
      ADD COLUMN IF NOT EXISTS "roomMutedRoomKey" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "bots"
      ADD COLUMN IF NOT EXISTS "globalMuted" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bots"
      DROP COLUMN IF EXISTS "globalMuted"
    `);
    await queryRunner.query(`
      ALTER TABLE "bots"
      DROP COLUMN IF EXISTS "roomMutedRoomKey"
    `);
    await queryRunner.query(`
      ALTER TABLE "bots"
      DROP COLUMN IF EXISTS "roomMuted"
    `);
  }
}
