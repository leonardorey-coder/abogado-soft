-- CreateTable
CREATE TABLE "user_document_pins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_document_pins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_document_pins_user_id_document_id_key" ON "user_document_pins"("user_id", "document_id");

-- CreateIndex
CREATE INDEX "user_document_pins_user_id_idx" ON "user_document_pins"("user_id");

-- CreateIndex
CREATE INDEX "user_document_pins_document_id_idx" ON "user_document_pins"("document_id");

-- AddForeignKey
ALTER TABLE "user_document_pins" ADD CONSTRAINT "user_document_pins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_document_pins" ADD CONSTRAINT "user_document_pins_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
