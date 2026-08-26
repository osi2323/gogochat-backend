import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFriendRequestIdentityIsolation20260504120000
  implements MigrationInterface
{
  name = 'AddFriendRequestIdentityIsolation20260504120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "friend_request" ADD COLUMN IF NOT EXISTS "requesterIdentityKey" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend_request" ADD COLUMN IF NOT EXISTS "requesterIdentityType" character varying(16) NOT NULL DEFAULT 'normal'`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend_request" ADD COLUMN IF NOT EXISTS "requesterDisplayName" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend_request" ADD COLUMN IF NOT EXISTS "addresseeIdentityKey" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend_request" ADD COLUMN IF NOT EXISTS "addresseeIdentityType" character varying(16) NOT NULL DEFAULT 'normal'`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend_request" ADD COLUMN IF NOT EXISTS "addresseeDisplayName" character varying(255)`,
    );

    await queryRunner.query(
      `UPDATE "friend_request" SET "requesterIdentityKey" = CONCAT('u:', "requesterId", ':normal') WHERE "requesterIdentityKey" = '' OR "requesterIdentityKey" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "friend_request" SET "addresseeIdentityKey" = CONCAT('u:', "addresseeId", ':normal') WHERE "addresseeIdentityKey" = '' OR "addresseeIdentityKey" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "friend_request" SET "requesterIdentityType" = 'normal' WHERE "requesterIdentityType" = '' OR "requesterIdentityType" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "friend_request" SET "addresseeIdentityType" = 'normal' WHERE "addresseeIdentityType" = '' OR "addresseeIdentityType" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "friend_request" DROP COLUMN IF EXISTS "addresseeDisplayName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend_request" DROP COLUMN IF EXISTS "addresseeIdentityType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend_request" DROP COLUMN IF EXISTS "addresseeIdentityKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend_request" DROP COLUMN IF EXISTS "requesterDisplayName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend_request" DROP COLUMN IF EXISTS "requesterIdentityType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend_request" DROP COLUMN IF EXISTS "requesterIdentityKey"`,
    );
  }
}
