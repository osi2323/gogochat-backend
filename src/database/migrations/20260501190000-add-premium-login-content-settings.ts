import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPremiumLoginContentSettings20260501190000
  implements MigrationInterface
{
  name = 'AddPremiumLoginContentSettings20260501190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "premiumArticleTopTitle" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "premiumArticleTopContent" text
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "premiumArticleMiddleTitle" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "premiumArticleMiddleContent" text
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "premiumArticleBottomTitle" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "premiumArticleBottomContent" text
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "premiumAndroidAppUrl" text
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "premiumIosAppUrl" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "premiumIosAppUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "premiumAndroidAppUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "premiumArticleBottomContent"
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "premiumArticleBottomTitle"
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "premiumArticleMiddleContent"
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "premiumArticleMiddleTitle"
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "premiumArticleTopContent"
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "premiumArticleTopTitle"
    `);
  }
}
