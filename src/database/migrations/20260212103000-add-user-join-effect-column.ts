import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserJoinEffectColumn20260212103000
  implements MigrationInterface
{
  name = 'AddUserJoinEffectColumn20260212103000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "joinEffect" character varying(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "joinEffect"`,
    );
  }
}
