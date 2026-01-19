import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountEmailConfig1768600000000 implements MigrationInterface {
  name = 'AddAccountEmailConfig1768600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add max_per_hour column with default 100
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD "max_per_hour" integer NOT NULL DEFAULT 100`,
    );

    // Add delay_between_emails column with default 3000 (3 seconds in milliseconds)
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD "delay_between_emails" integer NOT NULL DEFAULT 3000`,
    );

    // Update daily_limit default from 300 to 500
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "daily_limit" SET DEFAULT 500`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert daily_limit default to 300
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "daily_limit" SET DEFAULT 300`,
    );

    // Drop delay_between_emails column
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP COLUMN "delay_between_emails"`,
    );

    // Drop max_per_hour column
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP COLUMN "max_per_hour"`,
    );
  }
}
