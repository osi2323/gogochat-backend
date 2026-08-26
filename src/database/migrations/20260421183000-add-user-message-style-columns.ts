import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserMessageStyleColumns20260421183000
  implements MigrationInterface
{
  name = 'AddUserMessageStyleColumns20260421183000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "userFontName" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "userGranite" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "userNickColor" character varying
    `);
    await queryRunner.query(`
      UPDATE "messages" AS message
      SET
        "userFontName" = "user"."fontName",
        "userGranite" = "user"."granite",
        "userNickColor" = "user"."nickColor"
      FROM "user"
      WHERE
        message."userId" = "user"."id"
        AND message."botId" IS NULL
        AND (
          message."userFontName" IS NULL
          OR message."userGranite" IS NULL
          OR message."userNickColor" IS NULL
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "userNickColor"
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "userGranite"
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "userFontName"
    `);
  }
}
