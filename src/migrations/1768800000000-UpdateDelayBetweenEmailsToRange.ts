import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateDelayBetweenEmailsToRange1768800000000
  implements MigrationInterface
{
  name = 'UpdateDelayBetweenEmailsToRange1768800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename existing column to delay_between_emails_from
    await queryRunner.query(`
      ALTER TABLE "accounts"
      RENAME COLUMN "delay_between_emails" TO "delay_between_emails_from"
    `);

    // Add new column delay_between_emails_to with default value
    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD COLUMN "delay_between_emails_to" integer NOT NULL DEFAULT 5000
    `);

    // Set delay_between_emails_to = delay_between_emails_from + 2000 for existing records
    await queryRunner.query(`
      UPDATE "accounts"
      SET "delay_between_emails_to" = "delay_between_emails_from" + 2000
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove delay_between_emails_to column
    await queryRunner.query(`
      ALTER TABLE "accounts"
      DROP COLUMN "delay_between_emails_to"
    `);

    // Rename delay_between_emails_from back to delay_between_emails
    await queryRunner.query(`
      ALTER TABLE "accounts"
      RENAME COLUMN "delay_between_emails_from" TO "delay_between_emails"
    `);
  }
}
