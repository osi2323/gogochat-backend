import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatSiteTheme20260830143000 implements MigrationInterface {
  name = 'AddChatSiteTheme20260830143000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "chatSiteTheme" character varying(20) NOT NULL DEFAULT 'dark'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "chatSiteTheme"
    `);
  }
}
