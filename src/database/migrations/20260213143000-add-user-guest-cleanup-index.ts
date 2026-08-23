import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGuestCleanupIndex20260213143000
  implements MigrationInterface
{
  name = 'AddUserGuestCleanupIndex20260213143000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_guest_cleanup_active" ON "user" ("isGuest", "guestExpiresAt") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_guest_cleanup_active"`,
    );
  }
}
