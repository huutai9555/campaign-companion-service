import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCampaignSendSettings1768202601119 implements MigrationInterface {
  name = 'RemoveCampaignSendSettings1768202601119';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP COLUMN "delay_between_emails"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP COLUMN "max_retries"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP COLUMN "retry_delay"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD "delay_between_emails" integer NOT NULL DEFAULT 10`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD "max_retries" integer NOT NULL DEFAULT 3`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD "retry_delay" integer NOT NULL DEFAULT 0`,
    );
  }
}
