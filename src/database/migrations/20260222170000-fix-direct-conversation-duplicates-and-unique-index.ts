import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDirectConversationDuplicatesAndUniqueIndex20260222170000
  implements MigrationInterface
{
  name = 'FixDirectConversationDuplicatesAndUniqueIndex20260222170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH grouped AS (
        SELECT
          MIN(id) AS keep_id,
          "user1Id",
          "user2Id",
          MAX("lastMessageAt") AS max_last_message_at,
          MAX("lastReadAtUser1") AS max_last_read_at_user1,
          MAX("lastReadAtUser2") AS max_last_read_at_user2,
          MAX("clearedAtUser1") AS max_cleared_at_user1,
          MAX("clearedAtUser2") AS max_cleared_at_user2
        FROM "direct_conversations"
        GROUP BY "user1Id", "user2Id"
      )
      UPDATE "direct_conversations" c
      SET
        "lastMessageAt" = g.max_last_message_at,
        "lastReadAtUser1" = g.max_last_read_at_user1,
        "lastReadAtUser2" = g.max_last_read_at_user2,
        "clearedAtUser1" = g.max_cleared_at_user1,
        "clearedAtUser2" = g.max_cleared_at_user2
      FROM grouped g
      WHERE c.id = g.keep_id
    `);

    await queryRunner.query(`
      WITH grouped AS (
        SELECT MIN(id) AS keep_id, "user1Id", "user2Id"
        FROM "direct_conversations"
        GROUP BY "user1Id", "user2Id"
      ),
      duplicates AS (
        SELECT c.id AS duplicate_id, g.keep_id
        FROM "direct_conversations" c
        JOIN grouped g
          ON c."user1Id" = g."user1Id"
         AND c."user2Id" = g."user2Id"
        WHERE c.id <> g.keep_id
      )
      UPDATE "direct_messages" dm
      SET "conversationId" = d.keep_id
      FROM duplicates d
      WHERE dm."conversationId" = d.duplicate_id
    `);

    await queryRunner.query(`
      WITH grouped AS (
        SELECT MIN(id) AS keep_id, "user1Id", "user2Id"
        FROM "direct_conversations"
        GROUP BY "user1Id", "user2Id"
      )
      DELETE FROM "direct_conversations" c
      USING grouped g
      WHERE c."user1Id" = g."user1Id"
        AND c."user2Id" = g."user2Id"
        AND c.id <> g.keep_id
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_f54dbbe3b6a8631190e60d8e4f"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_f54dbbe3b6a8631190e60d8e4f" ON "direct_conversations" ("user1Id", "user2Id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_f54dbbe3b6a8631190e60d8e4f"`,
    );
  }
}
