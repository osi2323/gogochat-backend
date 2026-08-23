import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomMessageVisibilitySessions20260515143000
  implements MigrationInterface
{
  name = 'AddRoomMessageVisibilitySessions20260515143000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "room_message_visibility_sessions" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "identityKey" character varying(255) NOT NULL DEFAULT '',
        "roomId" integer NOT NULL,
        "joinedAt" TIMESTAMP NOT NULL,
        "leftAt" TIMESTAMP,
        "joinedAfterMessageId" integer NOT NULL DEFAULT 0,
        "leftMessageId" integer,
        "socketId" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_message_visibility_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_room_visibility_identity_room"
      ON "room_message_visibility_sessions" ("userId", "identityKey", "roomId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_room_visibility_socket"
      ON "room_message_visibility_sessions" ("socketId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_room_visibility_socket"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_room_visibility_identity_room"',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS "room_message_visibility_sessions"',
    );
  }
}
