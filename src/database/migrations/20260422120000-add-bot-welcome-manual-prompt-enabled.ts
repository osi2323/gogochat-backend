import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBotWelcomeManualPromptEnabled20260422120000
  implements MigrationInterface
{
  name = 'AddBotWelcomeManualPromptEnabled20260422120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bots"
      ADD COLUMN IF NOT EXISTS "welcomeManualPromptEnabled" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "bots"
      ADD COLUMN IF NOT EXISTS "welcomeAutoSendEnabled" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      UPDATE "bots"
      SET "welcomeAutoSendEnabled" = CASE
        WHEN "welcomeManualPromptEnabled" = true THEN false
        ELSE true
      END
      WHERE "isAI" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bots"
      DROP COLUMN IF EXISTS "welcomeAutoSendEnabled"
    `);
    await queryRunner.query(`
      ALTER TABLE "bots"
      DROP COLUMN IF EXISTS "welcomeManualPromptEnabled"
    `);
  }
}
