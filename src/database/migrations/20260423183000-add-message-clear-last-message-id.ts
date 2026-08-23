import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageClearLastMessageId20260423183000
  implements MigrationInterface
{
  name = 'AddMessageClearLastMessageId20260423183000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_clears" ADD COLUMN IF NOT EXISTS "lastClearedMessageId" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_clears" DROP COLUMN IF EXISTS "lastClearedMessageId"`,
    );
  }
}
