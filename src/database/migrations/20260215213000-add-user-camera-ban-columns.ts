import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserCameraBanColumns20260215213000
  implements MigrationInterface
{
  name = 'AddUserCameraBanColumns20260215213000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "cameraBanned" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "cameraBannedByStarCount" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "cameraBannedByStarCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "cameraBanned"`,
    );
  }
}
