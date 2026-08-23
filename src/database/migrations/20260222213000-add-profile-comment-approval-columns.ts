import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileCommentApprovalColumns20260222213000
  implements MigrationInterface
{
  name = 'AddProfileCommentApprovalColumns20260222213000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profile_comments" ADD COLUMN IF NOT EXISTS "status" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_comments" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_comments" ADD COLUMN IF NOT EXISTS "approvedByUserId" integer`,
    );
    await queryRunner.query(
      `UPDATE "profile_comments" SET "status" = 'approved' WHERE "status" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_comments" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_comments" ALTER COLUMN "status" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_comments" ADD CONSTRAINT "FK_profile_comments_approvedByUserId" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profile_comments" DROP CONSTRAINT IF EXISTS "FK_profile_comments_approvedByUserId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_comments" DROP COLUMN IF EXISTS "approvedByUserId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_comments" DROP COLUMN IF EXISTS "approvedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_comments" DROP COLUMN IF EXISTS "status"`,
    );
  }
}
