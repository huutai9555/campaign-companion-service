import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterImportSessionIdToUuid1766989601408 implements MigrationInterface {
    name = 'AlterImportSessionIdToUuid1766989601408'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_recipients" DROP CONSTRAINT "FK_5996f60cd5c76d463210d9b7ea8"`);
        await queryRunner.query(`ALTER TABLE "email_recipients" DROP COLUMN "email_import_session_id"`);
        // Delete rows with null import_session_id before altering column type
        await queryRunner.query(`DELETE FROM "email_recipients" WHERE "import_session_id" IS NULL`);
        await queryRunner.query(`ALTER TABLE "email_recipients" ALTER COLUMN "import_session_id" TYPE uuid USING "import_session_id"::uuid`);
        await queryRunner.query(`ALTER TABLE "email_recipients" ALTER COLUMN "import_session_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "email_recipients" ADD CONSTRAINT "FK_90de877370eb54be6f7fbb39ad1" FOREIGN KEY ("import_session_id") REFERENCES "email_import_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_recipients" DROP CONSTRAINT "FK_90de877370eb54be6f7fbb39ad1"`);
        await queryRunner.query(`ALTER TABLE "email_recipients" DROP COLUMN "import_session_id"`);
        await queryRunner.query(`ALTER TABLE "email_recipients" ADD "import_session_id" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "email_recipients" ADD "email_import_session_id" uuid`);
        await queryRunner.query(`ALTER TABLE "email_recipients" ADD CONSTRAINT "FK_5996f60cd5c76d463210d9b7ea8" FOREIGN KEY ("email_import_session_id") REFERENCES "email_import_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
