import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBotMessageColumns20260301143000
  implements MigrationInterface
{
  name = 'AddBotMessageColumns20260301143000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
      ALTER COLUMN "userId" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "botId" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "botUsername" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "botSpeakerUsername" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "botSpeakerDisplayName" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "botAvatar" text
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "botGender" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "botFontName" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "botGranite" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "botGranite"
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "botFontName"
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "botGender"
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "botAvatar"
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "botSpeakerDisplayName"
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "botSpeakerUsername"
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "botUsername"
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "botId"
    `);
  }
}
