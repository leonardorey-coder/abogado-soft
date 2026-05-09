-- AlterTable
ALTER TABLE "users" ADD COLUMN     "terms_accepted_at" TIMESTAMPTZ,
ADD COLUMN     "privacy_accepted_at" TIMESTAMPTZ,
ADD COLUMN     "terms_reconfirmed_at" TIMESTAMPTZ,
ADD COLUMN     "privacy_reconfirmed_at" TIMESTAMPTZ;
