import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunicationPermissionSettings20260508223000
  implements MigrationInterface
{
  name = 'AddCommunicationPermissionSettings20260508223000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "membersPrivateMessageEnabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "membersVoiceCallEnabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "guestPrivateMessageEnabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "guestVoiceCallEnabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "memberAndGuestMicDurationSeconds" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      DROP COLUMN IF EXISTS "memberAndGuestMicDurationSeconds",
      DROP COLUMN IF EXISTS "guestVoiceCallEnabled",
      DROP COLUMN IF EXISTS "guestPrivateMessageEnabled",
      DROP COLUMN IF EXISTS "membersVoiceCallEnabled",
      DROP COLUMN IF EXISTS "membersPrivateMessageEnabled"
    `);
  }
}
