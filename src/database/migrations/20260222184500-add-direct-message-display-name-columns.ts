import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectMessageDisplayNameColumns20260222184500
  implements MigrationInterface
{
  name = 'AddDirectMessageDisplayNameColumns20260222184500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "senderDisplayName" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "user1DisplayName" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "user2DisplayName" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" DROP COLUMN IF EXISTS "user2DisplayName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_conversations" DROP COLUMN IF EXISTS "user1DisplayName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_messages" DROP COLUMN IF EXISTS "senderDisplayName"`,
    );
  }
}

