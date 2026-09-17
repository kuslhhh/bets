CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "phone_number" VARCHAR(20),
    "designation" VARCHAR(100),
    "company_name" VARCHAR(200),
    "industry_type" VARCHAR(100),
    "nature_of_work" VARCHAR(100),
    "revenue_bracket" VARCHAR(50),
    "product" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FINANCIAL_MATURITY',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "open_at" TIMESTAMP(3),
    "close_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "source_text" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "source_text" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "source_number" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SINGLE_SELECT',
    "section_id" TEXT NOT NULL,
    "category_id" TEXT,
    "prompt_text" TEXT NOT NULL,
    "source_text" TEXT,
    "order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "slot_count" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,
    "score_value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_assignments" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "due_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "assigned_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "question_option_id" TEXT NOT NULL,
    "score_value" INTEGER NOT NULL,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "text_answers" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "answer_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "text_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_results" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "overall_self" DECIMAL(5,2),
    "overall_org" DECIMAL(5,2),
    "overall_combined" DECIMAL(5,2),
    "min_category_score" DECIMAL(5,2),
    "max_category_score" DECIMAL(5,2),
    "scoring_version" TEXT NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_scores" (
    "id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "average_score" DECIMAL(5,2) NOT NULL,
    "question_count" INTEGER NOT NULL,
    "min_score" DECIMAL(5,2),
    "max_score" DECIMAL(5,2),

    CONSTRAINT "category_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "assessments_type_idx" ON "assessments"("type");

-- CreateIndex
CREATE INDEX "sections_assessment_id_idx" ON "sections"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "sections_assessment_id_order_key" ON "sections"("assessment_id", "order");

-- CreateIndex
CREATE INDEX "categories_section_id_idx" ON "categories"("section_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_section_id_order_key" ON "categories"("section_id", "order");

-- CreateIndex
CREATE INDEX "questions_assessment_id_idx" ON "questions"("assessment_id");

-- CreateIndex
CREATE INDEX "questions_section_id_idx" ON "questions"("section_id");

-- CreateIndex
CREATE INDEX "questions_category_id_idx" ON "questions"("category_id");

-- CreateIndex
CREATE INDEX "question_options_question_id_idx" ON "question_options"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_order_key" ON "question_options"("question_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_label_key" ON "question_options"("question_id", "label");

-- CreateIndex
CREATE INDEX "assessment_assignments_user_id_status_idx" ON "assessment_assignments"("user_id", "status");

-- CreateIndex
CREATE INDEX "assessment_assignments_assessment_id_status_idx" ON "assessment_assignments"("assessment_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_assignments_assessment_id_user_id_attempt_key" ON "assessment_assignments"("assessment_id", "user_id", "attempt");

-- CreateIndex
CREATE INDEX "responses_assignment_id_idx" ON "responses"("assignment_id");

-- CreateIndex
CREATE INDEX "responses_question_id_idx" ON "responses"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "responses_assignment_id_question_id_key" ON "responses"("assignment_id", "question_id");

-- CreateIndex
CREATE INDEX "text_answers_assignment_id_idx" ON "text_answers"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "text_answers_assignment_id_question_id_slot_index_key" ON "text_answers"("assignment_id", "question_id", "slot_index");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_results_assignment_id_key" ON "assessment_results"("assignment_id");

-- CreateIndex
CREATE INDEX "assessment_results_assignment_id_idx" ON "assessment_results"("assignment_id");

-- CreateIndex
CREATE INDEX "assessment_results_scoring_version_idx" ON "assessment_results"("scoring_version");

-- CreateIndex
CREATE INDEX "category_scores_result_id_idx" ON "category_scores"("result_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_scores_result_id_category_id_key" ON "category_scores"("result_id", "category_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_assignments" ADD CONSTRAINT "assessment_assignments_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_assignments" ADD CONSTRAINT "assessment_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_assignments" ADD CONSTRAINT "assessment_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assessment_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_question_option_id_fkey" FOREIGN KEY ("question_option_id") REFERENCES "question_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "text_answers" ADD CONSTRAINT "text_answers_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assessment_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "text_answers" ADD CONSTRAINT "text_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assessment_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_scores" ADD CONSTRAINT "category_scores_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "assessment_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_scores" ADD CONSTRAINT "category_scores_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assessments" ADD CONSTRAINT "assessments_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'));
ALTER TABLE "questions" ADD CONSTRAINT "questions_type_check" CHECK ("type" IN ('SINGLE_SELECT', 'TEXT_MULTI_SLOT'));
ALTER TABLE "questions" ADD CONSTRAINT "questions_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'DEPRECATED'));
ALTER TABLE "assessment_assignments" ADD CONSTRAINT "assessment_assignments_status_check" CHECK ("status" IN ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED'));
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_score_check" CHECK ("score_value" IN (25, 50, 75, 100));
ALTER TABLE "responses" ADD CONSTRAINT "responses_score_check" CHECK ("score_value" IN (25, 50, 75, 100));
CREATE UNIQUE INDEX "users_lower_email_key" ON "users" (lower("email"));
