import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserFlashNickColumn20260223120000
  implements MigrationInterface
{
  name = 'AddUserFlashNickColumn20260223120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "flashNick" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "flashNick"`,
    );
  }
}
