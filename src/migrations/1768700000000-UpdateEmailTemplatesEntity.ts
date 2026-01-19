import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateEmailTemplatesEntity1768700000000
  implements MigrationInterface
{
  name = 'UpdateEmailTemplatesEntity1768700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add clerk_user_id column
    await queryRunner.query(
      `ALTER TABLE "email_templates" ADD "clerk_user_id" varchar`,
    );

    // Add name column
    await queryRunner.query(`ALTER TABLE "email_templates" ADD "name" varchar`);

    // Drop old foreign key constraint if exists
    await queryRunner.query(
      `ALTER TABLE "email_templates" DROP CONSTRAINT IF EXISTS "FK_email_templates_campaign_id"`,
    );

    // Drop old columns that are no longer needed
    await queryRunner.query(
      `ALTER TABLE "email_templates" DROP COLUMN IF EXISTS "campaign_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_templates" DROP COLUMN IF EXISTS "version_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_templates" DROP COLUMN IF EXISTS "is_active"`,
    );

    // Create junction table for ManyToMany relationship
    await queryRunner.query(`
      CREATE TABLE "campaign_email_templates" (
        "campaign_id" uuid NOT NULL,
        "email_template_id" uuid NOT NULL,
        PRIMARY KEY ("campaign_id", "email_template_id"),
        CONSTRAINT "FK_campaign_email_templates_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_campaign_email_templates_template" FOREIGN KEY ("email_template_id") REFERENCES "email_templates"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for better query performance
    await queryRunner.query(
      `CREATE INDEX "IDX_campaign_email_templates_campaign" ON "campaign_email_templates" ("campaign_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_campaign_email_templates_template" ON "campaign_email_templates" ("email_template_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_campaign_email_templates_campaign"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_campaign_email_templates_template"`,
    );

    // Drop junction table
    await queryRunner.query(`DROP TABLE IF EXISTS "campaign_email_templates"`);

    // Restore old columns
    await queryRunner.query(
      `ALTER TABLE "email_templates" ADD "campaign_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_templates" ADD "version_number" int DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_templates" ADD "is_active" boolean DEFAULT false`,
    );

    // Restore foreign key
    await queryRunner.query(
      `ALTER TABLE "email_templates" ADD CONSTRAINT "FK_email_templates_campaign_id" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE`,
    );

    // Remove new columns
    await queryRunner.query(
      `ALTER TABLE "email_templates" DROP COLUMN IF EXISTS "name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_templates" DROP COLUMN IF EXISTS "clerk_user_id"`,
    );
  }
}
