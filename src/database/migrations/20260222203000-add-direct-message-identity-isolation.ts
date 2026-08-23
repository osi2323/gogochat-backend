import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectMessageIdentityIsolation20260222203000
  implements MigrationInterface
{
  name = 'AddDirectMessageIdentityIsolation20260222203000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "user1IdentityKey" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "user1IdentityType" character varying(16) NOT NULL DEFAULT 'normal'`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "user2IdentityKey" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "user2IdentityType" character varying(16) NOT NULL DEFAULT 'normal'`,
    );

    await queryRunner.query(
      `UPDATE "direct_conversations" SET "user1IdentityKey" = CONCAT('u:', "user1Id", ':normal') WHERE "user1IdentityKey" = '' OR "user1IdentityKey" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "direct_conversations" SET "user2IdentityKey" = CONCAT('u:', "user2Id", ':normal') WHERE "user2IdentityKey" = '' OR "user2IdentityKey" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "senderIdentityKey" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "senderIdentityType" character varying(16) NOT NULL DEFAULT 'normal'`,
    );

    await queryRunner.query(`
      UPDATE "direct_messages" dm
      SET "senderIdentityKey" = CASE
        WHEN dc."user1Id" = dm."senderId" THEN dc."user1IdentityKey"
        WHEN dc."user2Id" = dm."senderId" THEN dc."user2IdentityKey"
        ELSE CONCAT('u:', dm."senderId", ':normal')
      END
      FROM "direct_conversations" dc
      WHERE dm."conversationId" = dc."id"
        AND (dm."senderIdentityKey" = '' OR dm."senderIdentityKey" IS NULL)
    `);
    await queryRunner.query(
      `UPDATE "direct_messages" SET "senderIdentityKey" = CONCAT('u:', "senderId", ':normal') WHERE "senderIdentityKey" = '' OR "senderIdentityKey" IS NULL`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_f54dbbe3b6a8631190e60d8e4f"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_f54dbbe3b6a8631190e60d8e4f" ON "direct_conversations" ("user1Id", "user2Id", "user1IdentityKey", "user2IdentityKey")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_f54dbbe3b6a8631190e60d8e4f"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_f54dbbe3b6a8631190e60d8e4f" ON "direct_conversations" ("user1Id", "user2Id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "direct_messages" DROP COLUMN IF EXISTS "senderIdentityType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_messages" DROP COLUMN IF EXISTS "senderIdentityKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" DROP COLUMN IF EXISTS "user2IdentityType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" DROP COLUMN IF EXISTS "user2IdentityKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" DROP COLUMN IF EXISTS "user1IdentityType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" DROP COLUMN IF EXISTS "user1IdentityKey"`,
    );
  }
}
