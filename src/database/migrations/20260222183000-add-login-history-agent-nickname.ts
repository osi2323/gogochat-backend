import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoginHistoryAgentNickname20260222183000
  implements MigrationInterface
{
  name = 'AddLoginHistoryAgentNickname20260222183000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "login_history" ADD COLUMN IF NOT EXISTS "agentNickname" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "login_history" DROP COLUMN IF EXISTS "agentNickname"`,
    );
  }
}
