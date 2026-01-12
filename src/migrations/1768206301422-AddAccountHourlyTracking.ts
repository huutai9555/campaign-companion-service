import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountHourlyTracking1768206301422
  implements MigrationInterface
{
  name = 'AddAccountHourlyTracking1768206301422';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add sent_this_hour column
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD "sent_this_hour" integer NOT NULL DEFAULT 0`,
    );

    // Add hour_started_at column
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD "hour_started_at" TIMESTAMP`,
    );

    // Change last_reset_date from DATE to TIMESTAMP
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "last_reset_date" TYPE TIMESTAMP USING "last_reset_date"::timestamp`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert last_reset_date to DATE
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "last_reset_date" TYPE DATE USING "last_reset_date"::date`,
    );

    // Drop hour_started_at column
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP COLUMN "hour_started_at"`,
    );

    // Drop sent_this_hour column
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP COLUMN "sent_this_hour"`,
    );
  }
}
