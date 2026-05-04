-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "public" VERSION "1.3";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog" VERSION "1.0";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "public" VERSION "1.1";

-- CreateEnum
CREATE TYPE "public"."activity_type" AS ENUM ('LOGIN', 'LOGOUT', 'DOCUMENT_CREATED', 'DOCUMENT_UPDATED', 'DOCUMENT_DELETED', 'DOCUMENT_RESTORED', 'DOCUMENT_SHARED', 'DOCUMENT_ASSIGNED', 'DOCUMENT_DOWNLOADED', 'DOCUMENT_EXTRACTED', 'DOCUMENT_PERMISSION_CHANGED', 'DOCUMENT_VERSION_CREATED', 'DOCUMENT_COMMENT_ADDED', 'DOCUMENT_COMMENT_DELETED', 'CONVENIO_CREATED', 'CONVENIO_UPDATED', 'CONVENIO_DELETED', 'CONVENIO_VERSION_CREATED', 'CONVENIO_COMMENT_ADDED', 'CONVENIO_COMMENT_DELETED', 'GROUP_CREATED', 'GROUP_UPDATED', 'GROUP_DELETED', 'GROUP_MEMBER_ADDED', 'GROUP_MEMBER_REMOVED', 'ADMIN_ACCESS_GRANTED', 'ADMIN_ACCESS_DENIED', 'BACKUP_CREATED', 'BACKUP_RESTORED', 'USER_REGISTERED', 'USER_UPDATED', 'PASSWORD_CHANGED', 'SETTINGS_CHANGED', 'COLLABORATION_STARTED', 'COLLABORATION_ENDED', 'DOCUMENT_LOCKED', 'DOCUMENT_UNLOCKED', 'CASE_CREATED', 'CASE_UPDATED', 'CASE_DOCUMENT_LINKED', 'CASE_DOCUMENT_UNLINKED', 'DOCUMENT_FILE_STATUS_CHANGED', 'DOCUMENT_WORKFLOW_STATUS_CHANGED', 'DOCUMENT_VIEWED', 'CALENDAR_NOTE_CREATED', 'CALENDAR_NOTE_UPDATED', 'CALENDAR_NOTE_DELETED');

-- CreateEnum
CREATE TYPE "public"."backup_status" AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "public"."collaboration_status" AS ENUM ('VISTO', 'EDITADO', 'COMENTADO', 'REVISADO', 'APROBADO', 'PENDIENTE_REVISION', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "public"."convenio_status" AS ENUM ('activo', 'pendiente', 'vencido', 'expirado', 'cancelado');

-- CreateEnum
CREATE TYPE "public"."document_type" AS ENUM ('docx', 'doc', 'pdf', 'xlsx', 'xls', 'txt', 'rtf');

-- CreateEnum
CREATE TYPE "public"."file_status" AS ENUM ('ACTIVO', 'PENDIENTE', 'INACTIVO');

-- CreateEnum
CREATE TYPE "public"."group_role" AS ENUM ('admin', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "public"."permission_level" AS ENUM ('none', 'download', 'read', 'write', 'admin');

-- CreateEnum
CREATE TYPE "public"."sharing_status" AS ENUM ('ENVIADO', 'ASIGNADO');

-- CreateEnum
CREATE TYPE "public"."sync_entity_type" AS ENUM ('document', 'convenio', 'group', 'user', 'comment');

-- CreateEnum
CREATE TYPE "public"."sync_operation" AS ENUM ('create', 'update', 'delete');

-- CreateEnum
CREATE TYPE "public"."sync_status" AS ENUM ('pending', 'syncing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "public"."user_role" AS ENUM ('admin', 'asistente');

-- CreateTable
CREATE TABLE "public"."activity_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "activity" "public"."activity_type" NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" UUID,
    "entity_name" VARCHAR(500),
    "description" TEXT,
    "metadata" JSONB,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firm_id" UUID,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_access_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "session_token" VARCHAR(255),
    "ip_address" INET,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."backups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(500) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'full',
    "status" "public"."backup_status" NOT NULL DEFAULT 'pending',
    "file_path" TEXT,
    "cloud_url" TEXT,
    "storage_key" VARCHAR(512),
    "size" BIGINT,
    "checksum" VARCHAR(128),
    "documents_count" INTEGER DEFAULT 0,
    "created_by" UUID,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firm_id" UUID,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."calendar_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date_key" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."case_documents" (
    "case_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" UUID,

    CONSTRAINT "case_documents_pkey" PRIMARY KEY ("case_id","document_id")
);

-- CreateTable
CREATE TABLE "public"."cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_number" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "client" VARCHAR(255),
    "court" VARCHAR(255),
    "case_type" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT 'en_proceso',
    "description" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "responsible_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firm_id" UUID,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."convenio_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "convenio_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "content" TEXT NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convenio_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."convenio_documents" (
    "convenio_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" UUID,

    CONSTRAINT "convenio_documents_pkey" PRIMARY KEY ("convenio_id","document_id")
);

-- CreateTable
CREATE TABLE "public"."convenio_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "convenio_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "change_note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convenio_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."convenios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero" VARCHAR(100) NOT NULL,
    "institucion" VARCHAR(255) NOT NULL,
    "departamento" VARCHAR(255),
    "descripcion" TEXT,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "responsable_id" UUID,
    "estado" "public"."convenio_status" NOT NULL DEFAULT 'pendiente',
    "notas" TEXT,
    "monto" DECIMAL(14,2),
    "version" INTEGER NOT NULL DEFAULT 1,
    "table_data" JSONB,
    "drive_file_id" VARCHAR(255),
    "last_sync_at" TIMESTAMPTZ(6),
    "sync_status" "public"."sync_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firm_id" UUID,

    CONSTRAINT "convenios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_access_pins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "pin" VARCHAR(6) NOT NULL,
    "created_by" UUID NOT NULL,
    "used_by" UUID,
    "used_at" TIMESTAMPTZ(6),
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_pins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "assigned_to" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    "notes" TEXT,
    "due_date" DATE,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "content" TEXT NOT NULL,
    "page_number" INTEGER,
    "position_x" REAL,
    "position_y" REAL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_pdfs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "local_path" TEXT,
    "drive_file_id" VARCHAR(255),
    "storage_key" VARCHAR(512),
    "size" BIGINT NOT NULL DEFAULT 0,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pdfs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "user_id" UUID,
    "group_id" UUID,
    "permission_level" "public"."permission_level" NOT NULL DEFAULT 'read',
    "granted_by" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_sync_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "user_id" UUID,
    "operation" "public"."sync_operation" NOT NULL,
    "status" "public"."sync_status" NOT NULL,
    "drive_revision_id" VARCHAR(255),
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "local_path" TEXT,
    "cloud_url" TEXT,
    "storage_key" VARCHAR(512),
    "size" BIGINT NOT NULL DEFAULT 0,
    "checksum" VARCHAR(128),
    "change_note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(500) NOT NULL,
    "type" "public"."document_type" NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "local_path" TEXT,
    "cloud_url" TEXT,
    "owner_id" UUID,
    "group_id" UUID,
    "case_id" UUID,
    "file_status" "public"."file_status" NOT NULL DEFAULT 'ACTIVO',
    "collaboration_status" "public"."collaboration_status",
    "sharing_status" "public"."sharing_status",
    "version" INTEGER NOT NULL DEFAULT 1,
    "checksum" VARCHAR(128),
    "expiration_date" DATE,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "description" TEXT,
    "tags" TEXT[],
    "mime_type" VARCHAR(255),
    "storage_key" VARCHAR(512),
    "drive_file_id" VARCHAR(255),
    "drive_revision_id" VARCHAR(255),
    "last_sync_at" TIMESTAMPTZ(6),
    "sync_status" "public"."sync_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firm_id" UUID,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."firms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100),
    "logo_url" TEXT,
    "plan" VARCHAR(50) NOT NULL DEFAULT 'free',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invite_code" VARCHAR(20),

    CONSTRAINT "firms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "public"."group_role" NOT NULL DEFAULT 'viewer',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "invite_code" VARCHAR(64),
    "owner_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firm_id" UUID,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'info',
    "entity_type" VARCHAR(50),
    "entity_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sync_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" "public"."sync_entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "operation" "public"."sync_operation" NOT NULL,
    "payload" JSONB,
    "status" "public"."sync_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMPTZ(6),

    CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "session_token" VARCHAR(512) NOT NULL,
    "device_info" JSONB,
    "ip_address" INET,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_activity" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "theme" VARCHAR(20) NOT NULL DEFAULT 'light',
    "font_size" INTEGER NOT NULL DEFAULT 16,
    "notifications" BOOLEAN NOT NULL DEFAULT true,
    "auto_save" BOOLEAN NOT NULL DEFAULT true,
    "auto_save_interval" INTEGER NOT NULL DEFAULT 30,
    "language" VARCHAR(10) NOT NULL DEFAULT 'es',
    "storage_path" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "role" "public"."user_role" NOT NULL DEFAULT 'asistente',
    "avatar_url" TEXT,
    "phone" VARCHAR(50),
    "office_name" VARCHAR(255),
    "department" VARCHAR(255),
    "position" VARCHAR(255),
    "admin_pin_hash" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firm_id" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_log_activity_idx" ON "public"."activity_log"("activity" ASC);

-- CreateIndex
CREATE INDEX "activity_log_created_at_idx" ON "public"."activity_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "public"."activity_log"("entity_type" ASC, "entity_id" ASC);

-- CreateIndex
CREATE INDEX "activity_log_firm_id_idx" ON "public"."activity_log"("firm_id" ASC);

-- CreateIndex
CREATE INDEX "activity_log_user_id_idx" ON "public"."activity_log"("user_id" ASC);

-- CreateIndex
CREATE INDEX "admin_access_log_created_at_idx" ON "public"."admin_access_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_access_log_document_id_idx" ON "public"."admin_access_log"("document_id" ASC);

-- CreateIndex
CREATE INDEX "admin_access_log_user_id_idx" ON "public"."admin_access_log"("user_id" ASC);

-- CreateIndex
CREATE INDEX "backups_created_at_idx" ON "public"."backups"("created_at" DESC);

-- CreateIndex
CREATE INDEX "backups_firm_id_idx" ON "public"."backups"("firm_id" ASC);

-- CreateIndex
CREATE INDEX "backups_status_idx" ON "public"."backups"("status" ASC);

-- CreateIndex
CREATE INDEX "calendar_notes_date_key_idx" ON "public"."calendar_notes"("date_key" ASC);

-- CreateIndex
CREATE INDEX "calendar_notes_user_id_idx" ON "public"."calendar_notes"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_calendar_note_date_user" ON "public"."calendar_notes"("date_key" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "case_documents_case_id_idx" ON "public"."case_documents"("case_id" ASC);

-- CreateIndex
CREATE INDEX "case_documents_document_id_idx" ON "public"."case_documents"("document_id" ASC);

-- CreateIndex
CREATE INDEX "cases_case_number_idx" ON "public"."cases"("case_number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cases_case_number_key" ON "public"."cases"("case_number" ASC);

-- CreateIndex
CREATE INDEX "cases_case_type_idx" ON "public"."cases"("case_type" ASC);

-- CreateIndex
CREATE INDEX "cases_firm_id_idx" ON "public"."cases"("firm_id" ASC);

-- CreateIndex
CREATE INDEX "cases_responsible_id_idx" ON "public"."cases"("responsible_id" ASC);

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "public"."cases"("status" ASC);

-- CreateIndex
CREATE INDEX "convenio_comments_convenio_id_idx" ON "public"."convenio_comments"("convenio_id" ASC);

-- CreateIndex
CREATE INDEX "convenio_comments_parent_id_idx" ON "public"."convenio_comments"("parent_id" ASC);

-- CreateIndex
CREATE INDEX "convenio_comments_user_id_idx" ON "public"."convenio_comments"("user_id" ASC);

-- CreateIndex
CREATE INDEX "convenio_versions_convenio_id_idx" ON "public"."convenio_versions"("convenio_id" ASC);

-- CreateIndex
CREATE INDEX "convenio_versions_created_by_idx" ON "public"."convenio_versions"("created_by" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_convenio_version" ON "public"."convenio_versions"("convenio_id" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "convenios_estado_idx" ON "public"."convenios"("estado" ASC);

-- CreateIndex
CREATE INDEX "convenios_fecha_fin_idx" ON "public"."convenios"("fecha_fin" ASC);

-- CreateIndex
CREATE INDEX "convenios_firm_id_idx" ON "public"."convenios"("firm_id" ASC);

-- CreateIndex
CREATE INDEX "convenios_institucion_idx" ON "public"."convenios"("institucion" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "convenios_numero_key" ON "public"."convenios"("numero" ASC);

-- CreateIndex
CREATE INDEX "convenios_responsable_id_idx" ON "public"."convenios"("responsable_id" ASC);

-- CreateIndex
CREATE INDEX "document_access_pins_document_id_idx" ON "public"."document_access_pins"("document_id" ASC);

-- CreateIndex
CREATE INDEX "document_access_pins_pin_idx" ON "public"."document_access_pins"("pin" ASC);

-- CreateIndex
CREATE INDEX "document_assignments_assigned_by_idx" ON "public"."document_assignments"("assigned_by" ASC);

-- CreateIndex
CREATE INDEX "document_assignments_assigned_to_idx" ON "public"."document_assignments"("assigned_to" ASC);

-- CreateIndex
CREATE INDEX "document_assignments_document_id_idx" ON "public"."document_assignments"("document_id" ASC);

-- CreateIndex
CREATE INDEX "document_assignments_status_idx" ON "public"."document_assignments"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_doc_assignment" ON "public"."document_assignments"("document_id" ASC, "assigned_to" ASC);

-- CreateIndex
CREATE INDEX "document_comments_document_id_idx" ON "public"."document_comments"("document_id" ASC);

-- CreateIndex
CREATE INDEX "document_comments_parent_id_idx" ON "public"."document_comments"("parent_id" ASC);

-- CreateIndex
CREATE INDEX "document_comments_user_id_idx" ON "public"."document_comments"("user_id" ASC);

-- CreateIndex
CREATE INDEX "document_pdfs_created_at_idx" ON "public"."document_pdfs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "document_pdfs_document_id_idx" ON "public"."document_pdfs"("document_id" ASC);

-- CreateIndex
CREATE INDEX "document_permissions_document_id_idx" ON "public"."document_permissions"("document_id" ASC);

-- CreateIndex
CREATE INDEX "document_permissions_group_id_idx" ON "public"."document_permissions"("group_id" ASC);

-- CreateIndex
CREATE INDEX "document_permissions_permission_level_idx" ON "public"."document_permissions"("permission_level" ASC);

-- CreateIndex
CREATE INDEX "document_permissions_user_id_idx" ON "public"."document_permissions"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_doc_group_perm" ON "public"."document_permissions"("document_id" ASC, "group_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_doc_user_perm" ON "public"."document_permissions"("document_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "document_sync_log_created_at_idx" ON "public"."document_sync_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "document_sync_log_document_id_idx" ON "public"."document_sync_log"("document_id" ASC);

-- CreateIndex
CREATE INDEX "document_sync_log_status_idx" ON "public"."document_sync_log"("status" ASC);

-- CreateIndex
CREATE INDEX "document_versions_created_by_idx" ON "public"."document_versions"("created_by" ASC);

-- CreateIndex
CREATE INDEX "document_versions_document_id_idx" ON "public"."document_versions"("document_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_doc_version" ON "public"."document_versions"("document_id" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "documents_case_id_idx" ON "public"."documents"("case_id" ASC);

-- CreateIndex
CREATE INDEX "documents_collaboration_status_idx" ON "public"."documents"("collaboration_status" ASC);

-- CreateIndex
CREATE INDEX "documents_file_status_idx" ON "public"."documents"("file_status" ASC);

-- CreateIndex
CREATE INDEX "documents_firm_id_idx" ON "public"."documents"("firm_id" ASC);

-- CreateIndex
CREATE INDEX "documents_group_id_idx" ON "public"."documents"("group_id" ASC);

-- CreateIndex
CREATE INDEX "documents_is_deleted_idx" ON "public"."documents"("is_deleted" ASC);

-- CreateIndex
CREATE INDEX "documents_owner_id_idx" ON "public"."documents"("owner_id" ASC);

-- CreateIndex
CREATE INDEX "documents_sharing_status_idx" ON "public"."documents"("sharing_status" ASC);

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "public"."documents"("type" ASC);

-- CreateIndex
CREATE INDEX "documents_updated_at_idx" ON "public"."documents"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "firms_invite_code_idx" ON "public"."firms"("invite_code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "firms_invite_code_key" ON "public"."firms"("invite_code" ASC);

-- CreateIndex
CREATE INDEX "firms_slug_idx" ON "public"."firms"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "firms_slug_key" ON "public"."firms"("slug" ASC);

-- CreateIndex
CREATE INDEX "group_members_group_id_idx" ON "public"."group_members"("group_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "public"."group_members"("group_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "group_members_user_id_idx" ON "public"."group_members"("user_id" ASC);

-- CreateIndex
CREATE INDEX "groups_firm_id_idx" ON "public"."groups"("firm_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "groups_invite_code_key" ON "public"."groups"("invite_code" ASC);

-- CreateIndex
CREATE INDEX "groups_owner_id_idx" ON "public"."groups"("owner_id" ASC);

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "public"."notifications"("created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "public"."notifications"("type" ASC);

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "public"."notifications"("user_id" ASC);

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "public"."notifications"("user_id" ASC, "is_read" ASC);

-- CreateIndex
CREATE INDEX "sync_queue_created_at_idx" ON "public"."sync_queue"("created_at" ASC);

-- CreateIndex
CREATE INDEX "sync_queue_entity_type_entity_id_idx" ON "public"."sync_queue"("entity_type" ASC, "entity_id" ASC);

-- CreateIndex
CREATE INDEX "sync_queue_status_idx" ON "public"."sync_queue"("status" ASC);

-- CreateIndex
CREATE INDEX "user_sessions_is_active_expires_at_idx" ON "public"."user_sessions"("is_active" ASC, "expires_at" ASC);

-- CreateIndex
CREATE INDEX "user_sessions_session_token_idx" ON "public"."user_sessions"("session_token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_session_token_key" ON "public"."user_sessions"("session_token" ASC);

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "public"."user_sessions"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "public"."user_settings"("user_id" ASC);

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "users_firm_id_idx" ON "public"."users"("firm_id" ASC);

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "public"."users"("is_active" ASC);

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role" ASC);

-- AddForeignKey
ALTER TABLE "public"."activity_log" ADD CONSTRAINT "activity_log_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_access_log" ADD CONSTRAINT "admin_access_log_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_access_log" ADD CONSTRAINT "admin_access_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."backups" ADD CONSTRAINT "backups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."backups" ADD CONSTRAINT "backups_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."calendar_notes" ADD CONSTRAINT "calendar_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."case_documents" ADD CONSTRAINT "case_documents_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."case_documents" ADD CONSTRAINT "case_documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."case_documents" ADD CONSTRAINT "case_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cases" ADD CONSTRAINT "cases_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cases" ADD CONSTRAINT "cases_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."convenio_comments" ADD CONSTRAINT "convenio_comments_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."convenio_comments" ADD CONSTRAINT "convenio_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."convenio_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."convenio_comments" ADD CONSTRAINT "convenio_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."convenio_documents" ADD CONSTRAINT "convenio_documents_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."convenio_documents" ADD CONSTRAINT "convenio_documents_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."convenio_documents" ADD CONSTRAINT "convenio_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."convenio_versions" ADD CONSTRAINT "convenio_versions_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."convenio_versions" ADD CONSTRAINT "convenio_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."convenios" ADD CONSTRAINT "convenios_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."convenios" ADD CONSTRAINT "convenios_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_access_pins" ADD CONSTRAINT "document_access_pins_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_access_pins" ADD CONSTRAINT "document_access_pins_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_access_pins" ADD CONSTRAINT "document_access_pins_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_assignments" ADD CONSTRAINT "document_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_assignments" ADD CONSTRAINT "document_assignments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_assignments" ADD CONSTRAINT "document_assignments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_comments" ADD CONSTRAINT "document_comments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_comments" ADD CONSTRAINT "document_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."document_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_comments" ADD CONSTRAINT "document_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_pdfs" ADD CONSTRAINT "document_pdfs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_pdfs" ADD CONSTRAINT "document_pdfs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_permissions" ADD CONSTRAINT "document_permissions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_permissions" ADD CONSTRAINT "document_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_permissions" ADD CONSTRAINT "document_permissions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_permissions" ADD CONSTRAINT "document_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_sync_log" ADD CONSTRAINT "document_sync_log_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_sync_log" ADD CONSTRAINT "document_sync_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
