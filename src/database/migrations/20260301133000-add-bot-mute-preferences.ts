import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBotMutePreferences20260301133000
  implements MigrationInterface
{
  name = 'AddBotMutePreferences20260301133000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bot_mute_preferences" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "botId" integer NOT NULL,
        "roomKey" character varying(255),
        "muted" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_mute_preferences_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bot_mute_preferences_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bot_mute_preferences_bot" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bot_mute_preferences_global_unique"
      ON "bot_mute_preferences" ("userId", "botId")
      WHERE "roomKey" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bot_mute_preferences_room_unique"
      ON "bot_mute_preferences" ("userId", "botId", "roomKey")
      WHERE "roomKey" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bot_mute_preferences_room_unique"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bot_mute_preferences_global_unique"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "bot_mute_preferences"`);
  }
}
