import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCallHistory20260511120000 implements MigrationInterface {
  name = 'AddCallHistory20260511120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "call_history" (
        "id" SERIAL NOT NULL,
        "tenantId" character varying(255) NOT NULL,
        "userId" integer NOT NULL,
        "agentNickname" character varying(255) NOT NULL DEFAULT '',
        "callId" character varying(255) NOT NULL,
        "peerName" character varying(255) NOT NULL,
        "direction" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL,
        "startedAt" TIMESTAMP NOT NULL,
        "endedAt" TIMESTAMP,
        "durationSec" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_call_history_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_call_history_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_call_history_owner_started"
      ON "call_history" ("tenantId", "userId", "agentNickname", "startedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_call_history_owner_started"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "call_history"`);
  }
}
