import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGlobalMuteColumns20260215203000
  implements MigrationInterface
{
  name = 'AddUserGlobalMuteColumns20260215203000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "globalMuted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "globalMutedByStarCount" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "globalMutedByStarCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "globalMuted"`,
    );
  }
}
