import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1766652226729 implements MigrationInterface {
    name = 'InitialSchema1766652226729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "clerk_user_id" character varying NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "provider" character varying NOT NULL, "credentials_encrypted" jsonb NOT NULL, "daily_limit" integer NOT NULL DEFAULT '300', "sent_today" integer NOT NULL DEFAULT '0', "last_reset_date" date, "is_active" boolean NOT NULL DEFAULT true, "status" character varying NOT NULL DEFAULT 'active', CONSTRAINT "UQ_ee66de6cdc53993296d1ceb8aa0" UNIQUE ("email"), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."email_recipients_send_status_enum" AS ENUM('pending', 'sent', 'failed')`);
        await queryRunner.query(`CREATE TABLE "email_recipients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "clerk_user_id" character varying NOT NULL, "import_session_id" character varying NOT NULL, "name" character varying, "email" character varying NOT NULL, "category" character varying, "address" character varying, "send_status" "public"."email_recipients_send_status_enum" NOT NULL DEFAULT 'pending', "sent_at" TIMESTAMP, "retry_count" integer NOT NULL DEFAULT '0', "error_message" text, "email_import_session_id" uuid, CONSTRAINT "PK_4a507cbd8d2831e7bf9a437e147" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "email_import_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "clerk_user_id" character varying NOT NULL, "name" character varying, "file_name" character varying NOT NULL, CONSTRAINT "PK_027a60aad6a220995edd6c1e8fc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."campaigns_send_type_enum" AS ENUM('immediate', 'scheduled')`);
        await queryRunner.query(`CREATE TYPE "public"."campaigns_status_enum" AS ENUM('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "campaigns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "clerk_user_id" character varying NOT NULL, "name" character varying NOT NULL, "email_import_session_id" uuid, "send_type" "public"."campaigns_send_type_enum" NOT NULL, "scheduled_at" TIMESTAMP, "delay_between_emails" integer NOT NULL DEFAULT '10', "max_retries" integer NOT NULL DEFAULT '3', "retry_delay" integer NOT NULL DEFAULT '0', "status" "public"."campaigns_status_enum" NOT NULL DEFAULT 'draft', "total_recipients" integer NOT NULL DEFAULT '0', "total_sent" integer NOT NULL DEFAULT '0', "total_failed" integer NOT NULL DEFAULT '0', "started_at" TIMESTAMP, "completed_at" TIMESTAMP, CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "email_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "campaign_id" uuid NOT NULL, "version_number" integer NOT NULL, "subject" character varying NOT NULL, "content" text NOT NULL, "is_active" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_06c564c515d8cdb40b6f3bfbbb4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "campaign_email_accounts" ("campaign_id" uuid NOT NULL, "email_account_id" uuid NOT NULL, CONSTRAINT "PK_bd467872f510c39be2fcce3c585" PRIMARY KEY ("campaign_id", "email_account_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8b47b45728a52dbd1edc717565" ON "campaign_email_accounts" ("campaign_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d12bdc33576876656a0deda02" ON "campaign_email_accounts" ("email_account_id") `);
        await queryRunner.query(`ALTER TABLE "email_recipients" ADD CONSTRAINT "FK_5996f60cd5c76d463210d9b7ea8" FOREIGN KEY ("email_import_session_id") REFERENCES "email_import_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "campaigns" ADD CONSTRAINT "FK_f95cdbf12c833a7c01a93d04a4b" FOREIGN KEY ("email_import_session_id") REFERENCES "email_import_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "email_templates" ADD CONSTRAINT "FK_2bdfd30af25a189d8c1a961b0d4" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "campaign_email_accounts" ADD CONSTRAINT "FK_8b47b45728a52dbd1edc717565c" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "campaign_email_accounts" ADD CONSTRAINT "FK_9d12bdc33576876656a0deda02b" FOREIGN KEY ("email_account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaign_email_accounts" DROP CONSTRAINT "FK_9d12bdc33576876656a0deda02b"`);
        await queryRunner.query(`ALTER TABLE "campaign_email_accounts" DROP CONSTRAINT "FK_8b47b45728a52dbd1edc717565c"`);
        await queryRunner.query(`ALTER TABLE "email_templates" DROP CONSTRAINT "FK_2bdfd30af25a189d8c1a961b0d4"`);
        await queryRunner.query(`ALTER TABLE "campaigns" DROP CONSTRAINT "FK_f95cdbf12c833a7c01a93d04a4b"`);
        await queryRunner.query(`ALTER TABLE "email_recipients" DROP CONSTRAINT "FK_5996f60cd5c76d463210d9b7ea8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9d12bdc33576876656a0deda02"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b47b45728a52dbd1edc717565"`);
        await queryRunner.query(`DROP TABLE "campaign_email_accounts"`);
        await queryRunner.query(`DROP TABLE "email_templates"`);
        await queryRunner.query(`DROP TABLE "campaigns"`);
        await queryRunner.query(`DROP TYPE "public"."campaigns_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."campaigns_send_type_enum"`);
        await queryRunner.query(`DROP TABLE "email_import_sessions"`);
        await queryRunner.query(`DROP TABLE "email_recipients"`);
        await queryRunner.query(`DROP TYPE "public"."email_recipients_send_status_enum"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
    }

}
