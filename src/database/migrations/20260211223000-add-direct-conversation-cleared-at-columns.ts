import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectConversationClearedAtColumns20260211223000
  implements MigrationInterface
{
  name = 'AddDirectConversationClearedAtColumns20260211223000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "clearedAtUser1" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "clearedAtUser2" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" DROP COLUMN IF EXISTS "clearedAtUser2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" DROP COLUMN IF EXISTS "clearedAtUser1"`,
    );
  }
}
