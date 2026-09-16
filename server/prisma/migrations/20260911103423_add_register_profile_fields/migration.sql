-- AlterTable
ALTER TABLE "assessment_assignments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "assessment_results" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "assessments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "category_scores" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "question_options" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "questions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "responses" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "role_permissions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sections" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "text_answers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "company_name" VARCHAR(200),
ADD COLUMN     "designation" VARCHAR(100),
ADD COLUMN     "industry_type" VARCHAR(100),
ADD COLUMN     "nature_of_work" VARCHAR(100),
ADD COLUMN     "phone_number" VARCHAR(20),
ADD COLUMN     "product" VARCHAR(200),
ADD COLUMN     "revenue_bracket" VARCHAR(50),
ALTER COLUMN "id" DROP DEFAULT;
