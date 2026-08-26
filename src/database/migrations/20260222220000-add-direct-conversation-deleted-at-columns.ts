import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectConversationDeletedAtColumns20260222220000
  implements MigrationInterface
{
  name = 'AddDirectConversationDeletedAtColumns20260222220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "deletedAtUser1" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "deletedAtUser2" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" DROP COLUMN IF EXISTS "deletedAtUser2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" DROP COLUMN IF EXISTS "deletedAtUser1"`,
    );
  }
}
