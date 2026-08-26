import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectMessageReplies20260512143000
  implements MigrationInterface
{
  name = 'AddDirectMessageReplies20260512143000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "replyToMessageId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_messages" ADD CONSTRAINT "FK_direct_messages_reply_to_message" FOREIGN KEY ("replyToMessageId") REFERENCES "direct_messages"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_direct_messages_reply_to_message" ON "direct_messages" ("replyToMessageId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_direct_messages_reply_to_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_messages" DROP CONSTRAINT IF EXISTS "FK_direct_messages_reply_to_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_messages" DROP COLUMN IF EXISTS "replyToMessageId"`,
    );
  }
}
