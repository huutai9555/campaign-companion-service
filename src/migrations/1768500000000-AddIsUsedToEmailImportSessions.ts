import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsUsedToEmailImportSessions1768500000000
  implements MigrationInterface
{
  name = 'AddIsUsedToEmailImportSessions1768500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_import_sessions" ADD "is_used" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_import_sessions" DROP COLUMN "is_used"`,
    );
  }
}
