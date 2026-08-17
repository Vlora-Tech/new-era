-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('COURSE', 'EXAM_SIMULATOR');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MOCK', 'MOYASAR');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'INITIATED', 'PAID', 'FAILED', 'AUTHORIZED', 'CAPTURED', 'VERIFIED', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "EntitlementEventType" AS ENUM ('GRANTED', 'REVOKED', 'REACTIVATED');

-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('BUNNY');

-- CreateEnum
CREATE TYPE "VideoProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "StorageProviderKind" AS ENUM ('LOCAL', 'S3');

-- CreateEnum
CREATE TYPE "AssetVisibility" AS ENUM ('PUBLIC', 'PROTECTED');

-- CreateEnum
CREATE TYPE "QuestionTrack" AS ENUM ('SCIENTIFIC', 'THEORETICAL', 'BOTH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionWorkflow" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "QuestionDomain" AS ENUM ('VERBAL_ANALOGY', 'SENTENCE_COMPLETION', 'CONTEXTUAL_ERROR', 'READING_COMPREHENSION', 'ARITHMETIC', 'GEOMETRY', 'ALGEBRA', 'DATA_ANALYSIS');

-- CreateEnum
CREATE TYPE "RightsDeclaration" AS ENUM ('ORIGINAL', 'LICENSED');

-- CreateEnum
CREATE TYPE "StimulusType" AS ENUM ('PASSAGE', 'IMAGE', 'TABLE', 'CHART', 'MATH');

-- CreateEnum
CREATE TYPE "ExamVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "SelectionMode" AS ENUM ('FIXED', 'BLUEPRINT');

-- CreateEnum
CREATE TYPE "FeedbackMode" AS ENUM ('IMMEDIATE', 'AFTER_SUBMISSION');

-- CreateEnum
CREATE TYPE "AttemptMode" AS ENUM ('FULL_SIMULATION', 'TRAINING');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AttemptSectionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'LOCKED');

-- CreateEnum
CREATE TYPE "AttemptSectionLockReason" AS ENUM ('ADVANCED', 'EXPIRED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "blockedAt" TIMESTAMPTZ(6),
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" UUID,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "windowStartsAt" TIMESTAMPTZ(6) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "type" "ProductType" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "longDescription" TEXT,
    "coverAssetId" UUID,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "priceHalalas" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "category" TEXT,
    "level" TEXT,
    "completionThresholdPercent" INTEGER NOT NULL DEFAULT 90,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_simulators" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "track" "QuestionTrack" NOT NULL,
    "activeExamVersionId" UUID,
    "introVideoAssetId" UUID,
    "trainingModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "fullSimulationEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "exam_simulators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "sourceOrderId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_events" (
    "id" UUID NOT NULL,
    "entitlementId" UUID NOT NULL,
    "type" "EntitlementEventType" NOT NULL,
    "reason" TEXT,
    "orderId" UUID,
    "actorUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "position" INTEGER NOT NULL,
    "videoAssetId" UUID,
    "durationSec" INTEGER,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "completionThresholdPercent" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "lastPositionSec" INTEGER NOT NULL DEFAULT 0,
    "furthestPositionSec" INTEGER NOT NULL DEFAULT 0,
    "watchedSec" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_quizzes" (
    "id" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "feedbackMode" "FeedbackMode" NOT NULL DEFAULT 'AFTER_SUBMISSION',
    "maxAttempts" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lesson_quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_quiz_questions" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "lesson_quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_quiz_attempts" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "correctCount" INTEGER,
    "scorePercent" INTEGER,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMPTZ(6),

    CONSTRAINT "lesson_quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_quiz_answers" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "questionVersion" INTEGER NOT NULL,
    "selectedOptionKey" TEXT,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_stimuli" (
    "id" UUID NOT NULL,
    "type" "StimulusType" NOT NULL,
    "title" TEXT,
    "content" JSONB NOT NULL,
    "mediaAssetId" UUID,
    "authorOrLicensor" TEXT,
    "provenanceNote" TEXT,
    "rightsDeclaration" "RightsDeclaration",
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "question_stimuli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "stimulusId" UUID,
    "stem" JSONB NOT NULL,
    "track" "QuestionTrack" NOT NULL,
    "domain" "QuestionDomain" NOT NULL,
    "subskill" TEXT,
    "difficulty" "QuestionDifficulty" NOT NULL,
    "estimatedSeconds" INTEGER,
    "explanation" JSONB,
    "hint" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workflow" "QuestionWorkflow" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT true,
    "authorOrLicensor" TEXT NOT NULL,
    "provenanceNote" TEXT,
    "rightsDeclaration" "RightsDeclaration",
    "createdById" UUID,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewNote" TEXT,
    "publishedAt" TIMESTAMPTZ(6),
    "retiredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "position" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_versions" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "provider" "StorageProviderKind" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "visibility" "AssetVisibility" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksumSha256" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" UUID NOT NULL,
    "provider" "VideoProvider" NOT NULL DEFAULT 'BUNNY',
    "libraryId" TEXT NOT NULL,
    "videoGuid" TEXT NOT NULL,
    "title" TEXT,
    "durationSec" INTEGER,
    "processingStatus" "VideoProcessingStatus" NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playback_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "videoAssetId" UUID NOT NULL,
    "lessonId" UUID,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "lastHeartbeatAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playback_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_versions" (
    "id" UUID NOT NULL,
    "simulatorId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ExamVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "selectionMode" "SelectionMode" NOT NULL DEFAULT 'BLUEPRINT',
    "sourceLabel" TEXT,
    "sourceUrl" TEXT,
    "sourceRetrievedAt" TIMESTAMPTZ(6),
    "sourceNote" TEXT,
    "totalQuestions" INTEGER NOT NULL,
    "totalDurationSec" INTEGER NOT NULL,
    "resultDisclaimer" TEXT NOT NULL,
    "changeSummary" TEXT,
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_sections" (
    "id" UUID NOT NULL,
    "examVersionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "calculatorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scratchpadEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowReviewWithinSection" BOOLEAN NOT NULL DEFAULT true,
    "lockOnAdvance" BOOLEAN NOT NULL DEFAULT true,
    "pauseEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "exam_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_section_questions" (
    "id" UUID NOT NULL,
    "examSectionId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "questionVersion" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "exam_section_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_blueprint_rules" (
    "id" UUID NOT NULL,
    "examSectionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "track" "QuestionTrack",
    "domain" "QuestionDomain" NOT NULL,
    "subskill" TEXT,
    "difficulty" "QuestionDifficulty",
    "percentage" INTEGER,
    "questionCount" INTEGER,

    CONSTRAINT "exam_blueprint_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "simulatorId" UUID NOT NULL,
    "examVersionId" UUID NOT NULL,
    "mode" "AttemptMode" NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'CREATED',
    "settingsSnapshot" JSONB NOT NULL,
    "trainingConfig" JSONB,
    "seed" INTEGER NOT NULL,
    "isDryRun" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMPTZ(6),
    "maxEndAt" TIMESTAMPTZ(6),
    "submittedAt" TIMESTAMPTZ(6),
    "totalQuestions" INTEGER NOT NULL,
    "correctCount" INTEGER,
    "incorrectCount" INTEGER,
    "unansweredCount" INTEGER,
    "resultSummary" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_sections" (
    "id" UUID NOT NULL,
    "examAttemptId" UUID NOT NULL,
    "examSectionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "durationSecSnapshot" INTEGER,
    "policySnapshot" JSONB NOT NULL,
    "status" "AttemptSectionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMPTZ(6),
    "deadlineAt" TIMESTAMPTZ(6),
    "lockedAt" TIMESTAMPTZ(6),
    "lockedReason" "AttemptSectionLockReason",

    CONSTRAINT "attempt_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_questions" (
    "id" UUID NOT NULL,
    "attemptSectionId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "questionVersion" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "contentSnapshot" JSONB NOT NULL,
    "correctOptionKey" TEXT NOT NULL,
    "explanationSnapshot" JSONB,
    "hintSnapshot" JSONB,
    "domain" "QuestionDomain" NOT NULL,
    "subskill" TEXT,
    "difficulty" "QuestionDifficulty" NOT NULL,

    CONSTRAINT "attempt_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answers" (
    "id" UUID NOT NULL,
    "attemptQuestionId" UUID NOT NULL,
    "selectedOptionKey" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "saveVersion" INTEGER NOT NULL DEFAULT 0,
    "savedAt" TIMESTAMPTZ(6),
    "revealedAt" TIMESTAMPTZ(6),
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productType" "ProductType" NOT NULL,
    "productTitle" TEXT NOT NULL,
    "amountHalalas" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "provider" "PaymentProvider" NOT NULL,
    "checkoutRequestKey" UUID NOT NULL,
    "paidAt" TIMESTAMPTZ(6),
    "failedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "refundedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "configuredMode" "PaymentMode" NOT NULL,
    "providerPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amountHalalas" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "safeMetadata" JSONB,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "refundedHalalas" INTEGER NOT NULL DEFAULT 0,
    "refundedAt" TIMESTAMPTZ(6),
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reconcileCount" INTEGER NOT NULL DEFAULT 0,
    "lastReconciledAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "liveMode" BOOLEAN,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6),
    "claimedAt" TIMESTAMPTZ(6),
    "processedAt" TIMESTAMPTZ(6),
    "lastError" TEXT,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isBlocked_idx" ON "users"("isBlocked");

-- CreateIndex
CREATE INDEX "consent_records_userId_idx" ON "consent_records"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_windowStartsAt_idx" ON "rate_limit_buckets"("windowStartsAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_type_status_idx" ON "products"("type", "status");

-- CreateIndex
CREATE INDEX "products_featured_status_idx" ON "products"("featured", "status");

-- CreateIndex
CREATE UNIQUE INDEX "courses_productId_key" ON "courses"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_simulators_productId_key" ON "exam_simulators"("productId");

-- CreateIndex
CREATE INDEX "entitlements_productId_status_idx" ON "entitlements"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_userId_productId_key" ON "entitlements"("userId", "productId");

-- CreateIndex
CREATE INDEX "entitlement_events_entitlementId_createdAt_idx" ON "entitlement_events"("entitlementId", "createdAt");

-- CreateIndex
CREATE INDEX "course_modules_courseId_position_idx" ON "course_modules"("courseId", "position");

-- CreateIndex
CREATE INDEX "lessons_moduleId_position_idx" ON "lessons"("moduleId", "position");

-- CreateIndex
CREATE INDEX "lesson_progress_userId_completed_idx" ON "lesson_progress"("userId", "completed");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_userId_lessonId_key" ON "lesson_progress"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_quizzes_lessonId_key" ON "lesson_quizzes"("lessonId");

-- CreateIndex
CREATE INDEX "lesson_quiz_questions_quizId_position_idx" ON "lesson_quiz_questions"("quizId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_quiz_questions_quizId_questionId_key" ON "lesson_quiz_questions"("quizId", "questionId");

-- CreateIndex
CREATE INDEX "lesson_quiz_attempts_userId_submittedAt_idx" ON "lesson_quiz_attempts"("userId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_quiz_attempts_quizId_userId_attemptNumber_key" ON "lesson_quiz_attempts"("quizId", "userId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_quiz_answers_attemptId_questionId_key" ON "lesson_quiz_answers"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "questions_workflow_idx" ON "questions"("workflow");

-- CreateIndex
CREATE INDEX "questions_domain_difficulty_track_workflow_idx" ON "questions"("domain", "difficulty", "track", "workflow");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_questionId_position_key" ON "question_options"("questionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "question_versions_questionId_version_key" ON "question_versions"("questionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_objectKey_key" ON "media_assets"("objectKey");

-- CreateIndex
CREATE INDEX "media_assets_visibility_idx" ON "media_assets"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_libraryId_videoGuid_key" ON "video_assets"("libraryId", "videoGuid");

-- CreateIndex
CREATE INDEX "playback_sessions_userId_lessonId_idx" ON "playback_sessions"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "playback_sessions_expiresAt_idx" ON "playback_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "exam_versions_simulatorId_versionNumber_key" ON "exam_versions"("simulatorId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "exam_sections_examVersionId_position_key" ON "exam_sections"("examVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "exam_section_questions_examSectionId_questionId_key" ON "exam_section_questions"("examSectionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_section_questions_examSectionId_position_key" ON "exam_section_questions"("examSectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "exam_blueprint_rules_examSectionId_position_key" ON "exam_blueprint_rules"("examSectionId", "position");

-- CreateIndex
CREATE INDEX "exam_attempts_userId_createdAt_idx" ON "exam_attempts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "exam_attempts_simulatorId_status_idx" ON "exam_attempts"("simulatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_sections_examAttemptId_position_key" ON "attempt_sections"("examAttemptId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_questions_attemptSectionId_position_key" ON "attempt_questions"("attemptSectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_attemptQuestionId_key" ON "attempt_answers"("attemptQuestionId");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_userId_checkoutRequestKey_key" ON "orders"("userId", "checkoutRequestKey");

-- CreateIndex
CREATE INDEX "payment_attempts_orderId_idx" ON "payment_attempts"("orderId");

-- CreateIndex
CREATE INDEX "payment_attempts_status_createdAt_idx" ON "payment_attempts"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_providerPaymentId_key" ON "payment_attempts"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "webhook_events_status_nextAttemptAt_idx" ON "webhook_events"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_providerEventId_key" ON "webhook_events"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_simulators" ADD CONSTRAINT "exam_simulators_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_simulators" ADD CONSTRAINT "exam_simulators_activeExamVersionId_fkey" FOREIGN KEY ("activeExamVersionId") REFERENCES "exam_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_simulators" ADD CONSTRAINT "exam_simulators_introVideoAssetId_fkey" FOREIGN KEY ("introVideoAssetId") REFERENCES "video_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_events" ADD CONSTRAINT "entitlement_events_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "entitlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_events" ADD CONSTRAINT "entitlement_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_events" ADD CONSTRAINT "entitlement_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "video_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_quizzes" ADD CONSTRAINT "lesson_quizzes_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_quiz_questions" ADD CONSTRAINT "lesson_quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "lesson_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_quiz_questions" ADD CONSTRAINT "lesson_quiz_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_quiz_attempts" ADD CONSTRAINT "lesson_quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "lesson_quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_quiz_attempts" ADD CONSTRAINT "lesson_quiz_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_quiz_answers" ADD CONSTRAINT "lesson_quiz_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "lesson_quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_quiz_answers" ADD CONSTRAINT "lesson_quiz_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_stimuli" ADD CONSTRAINT "question_stimuli_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_stimulusId_fkey" FOREIGN KEY ("stimulusId") REFERENCES "question_stimuli"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "video_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_versions" ADD CONSTRAINT "exam_versions_simulatorId_fkey" FOREIGN KEY ("simulatorId") REFERENCES "exam_simulators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sections" ADD CONSTRAINT "exam_sections_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "exam_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_section_questions" ADD CONSTRAINT "exam_section_questions_examSectionId_fkey" FOREIGN KEY ("examSectionId") REFERENCES "exam_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_section_questions" ADD CONSTRAINT "exam_section_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_blueprint_rules" ADD CONSTRAINT "exam_blueprint_rules_examSectionId_fkey" FOREIGN KEY ("examSectionId") REFERENCES "exam_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_simulatorId_fkey" FOREIGN KEY ("simulatorId") REFERENCES "exam_simulators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "exam_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_sections" ADD CONSTRAINT "attempt_sections_examAttemptId_fkey" FOREIGN KEY ("examAttemptId") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_sections" ADD CONSTRAINT "attempt_sections_examSectionId_fkey" FOREIGN KEY ("examSectionId") REFERENCES "exam_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_attemptSectionId_fkey" FOREIGN KEY ("attemptSectionId") REFERENCES "attempt_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attemptQuestionId_fkey" FOREIGN KEY ("attemptQuestionId") REFERENCES "attempt_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Hand-written constraints that the Prisma schema language cannot express.
-- Keep this block in sync with the comments in prisma/schema.prisma.
-- ═══════════════════════════════════════════════════════════════════════════

-- Email uniqueness must not depend on the application remembering to normalise.
-- The service layer lowercases on write; this functional index is the backstop.
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));

-- Exactly one correct option per question. A question with zero or two correct
-- options is unpublishable by construction, not merely by validation.
CREATE UNIQUE INDEX "question_options_one_correct_key"
  ON "question_options" ("questionId")
  WHERE "isCorrect";

-- At most one live full-simulation attempt per student per exam version.
-- This is what makes attempt creation idempotent under a double-click or a
-- duplicated tab: the second insert loses, and the caller returns the first attempt.
CREATE UNIQUE INDEX "exam_attempts_one_live_per_version_key"
  ON "exam_attempts" ("userId", "examVersionId")
  WHERE "status" IN ('CREATED', 'IN_PROGRESS')
    AND "mode" = 'FULL_SIMULATION'
    AND "isDryRun" = false;

-- Money is a non-negative integer count of halalas everywhere it appears.
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_nonneg" CHECK ("priceHalalas" >= 0);
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amount_nonneg" CHECK ("amountHalalas" >= 0);
ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_amount_nonneg"
  CHECK ("amountHalalas" >= 0 AND "refundedHalalas" >= 0);

-- Currency is fixed for this MVP; a stray value would silently break pricing.
ALTER TABLE "products" ADD CONSTRAINT "products_currency_sar" CHECK ("currency" = 'SAR');
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_sar" CHECK ("currency" = 'SAR');

-- Progress counters are non-negative and the high-water mark never trails the
-- last position, so a bad heartbeat cannot corrupt resume behaviour.
ALTER TABLE "lesson_progress"
  ADD CONSTRAINT "lesson_progress_nonneg"
  CHECK ("lastPositionSec" >= 0 AND "furthestPositionSec" >= 0 AND "watchedSec" >= 0
     AND "furthestPositionSec" >= "lastPositionSec");

-- Completion thresholds are percentages.
ALTER TABLE "courses"
  ADD CONSTRAINT "courses_threshold_range"
  CHECK ("completionThresholdPercent" BETWEEN 1 AND 100);
ALTER TABLE "lessons"
  ADD CONSTRAINT "lessons_threshold_range"
  CHECK ("completionThresholdPercent" IS NULL
      OR "completionThresholdPercent" BETWEEN 1 AND 100);

-- Blueprint rules are expressed as a percentage or an explicit count, and a
-- percentage is a percentage.
ALTER TABLE "exam_blueprint_rules"
  ADD CONSTRAINT "exam_blueprint_rules_percentage_range"
  CHECK ("percentage" IS NULL OR "percentage" BETWEEN 0 AND 100);
ALTER TABLE "exam_blueprint_rules"
  ADD CONSTRAINT "exam_blueprint_rules_count_nonneg"
  CHECK ("questionCount" IS NULL OR "questionCount" >= 0);

-- Section timing and totals must be positive where present.
ALTER TABLE "exam_sections"
  ADD CONSTRAINT "exam_sections_positive"
  CHECK ("durationSec" > 0 AND "questionCount" > 0);
