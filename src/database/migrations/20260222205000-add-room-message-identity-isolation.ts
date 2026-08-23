import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomMessageIdentityIsolation20260222205000
  implements MigrationInterface
{
  name = 'AddRoomMessageIdentityIsolation20260222205000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderIdentityKey" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderIdentityType" character varying(16) NOT NULL DEFAULT 'normal'`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderPublicName" character varying(255)`,
    );
    await queryRunner.query(
      `UPDATE "messages" SET "senderIdentityKey" = CONCAT('u:', "userId", ':normal') WHERE "senderIdentityKey" = '' OR "senderIdentityKey" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "message_reads" ADD COLUMN IF NOT EXISTS "identityKey" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `UPDATE "message_reads" SET "identityKey" = CONCAT('u:', "userId", ':normal') WHERE "identityKey" = '' OR "identityKey" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_clears" ADD COLUMN IF NOT EXISTS "identityKey" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `UPDATE "message_clears" SET "identityKey" = CONCAT('u:', "userId", ':normal') WHERE "identityKey" = '' OR "identityKey" IS NULL`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_8f8ecf4f9d8e1f5e7b5c2c6b69"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_8c64a9a7f5f8c9e4f5b5a2b7b2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_reads" DROP CONSTRAINT IF EXISTS "UQ_350b3ef322f44be5318f58eb38d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_clears" DROP CONSTRAINT IF EXISTS "UQ_27d560f76755820f3adf6cd0644"`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_message_reads_identity_unique" ON "message_reads" ("messageId", "userId", "identityKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_message_reads_identity_lookup" ON "message_reads" ("userId", "identityKey", "messageId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_message_clears_identity_unique" ON "message_clears" ("userId", "roomId", "identityKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_message_clears_identity_lookup" ON "message_clears" ("userId", "identityKey", "roomId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_message_clears_identity_lookup"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_message_clears_identity_unique"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_message_reads_identity_lookup"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_message_reads_identity_unique"`,
    );

    await queryRunner.query(
      `ALTER TABLE "message_clears" DROP COLUMN IF EXISTS "identityKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_reads" DROP COLUMN IF EXISTS "identityKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN IF EXISTS "senderPublicName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN IF EXISTS "senderIdentityType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN IF EXISTS "senderIdentityKey"`,
    );
  }
}
