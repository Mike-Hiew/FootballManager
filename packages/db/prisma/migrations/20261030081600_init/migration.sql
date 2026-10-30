-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "lockedUntil" TIMESTAMPTZ,
    "disabledAt" TIMESTAMPTZ,
    "lastTeamId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "currentTeamId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "foundedOn" TEXT,
    "slogan" TEXT,
    "photoUrl" TEXT,
    "awardBootUrl" TEXT,
    "awardAssistUrl" TEXT,
    "homeName" TEXT,
    "homeAddress" TEXT,
    "homeMapUrl" TEXT,
    "homeDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "homeFrom" TEXT,
    "homeTo" TEXT,
    "homeCost" INTEGER NOT NULL DEFAULT 0,
    "rules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "formation" TEXT NOT NULL DEFAULT '2-3-1',
    "lineup" JSONB NOT NULL DEFAULT '[]',
    "monthlyFee" INTEGER NOT NULL DEFAULT 200000,
    "perMatchFee" INTEGER NOT NULL DEFAULT 80000,
    "planMinutes" INTEGER NOT NULL DEFAULT 80,
    "planPeriods" INTEGER NOT NULL DEFAULT 4,
    "planMin" INTEGER,
    "fullSquad" INTEGER NOT NULL DEFAULT 7,
    "duesReminder" BOOLEAN NOT NULL DEFAULT true,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_captains" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_captains_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "nick" TEXT,
    "dob" TEXT,
    "avatarUrl" TEXT,
    "num" INTEGER,
    "foot" TEXT NOT NULL,
    "payType" TEXT NOT NULL,
    "payTypeFrom" TEXT,
    "prevPayType" TEXT,
    "stats" JSONB NOT NULL,
    "styles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "join_requests" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_edits" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profile_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "kickoffAt" TIMESTAMPTZ NOT NULL,
    "opponent" TEXT NOT NULL,
    "venue" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Giao hữu',
    "cost" INTEGER NOT NULL DEFAULT 0,
    "fee" INTEGER NOT NULL,
    "note" TEXT,
    "scoreUs" INTEGER,
    "scoreThem" INTEGER,
    "voteState" TEXT,
    "voteOpenedAt" TIMESTAMPTZ,
    "voteRemindedAt" TIMESTAMPTZ,
    "formation" TEXT,
    "lineup" JSONB,
    "mvpPlayerId" TEXT,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "setByCaptain" BOOLEAN NOT NULL DEFAULT false,
    "lePaid" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("matchId","playerId")
);

-- CreateTable
CREATE TABLE "match_events" (
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("matchId","playerId")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mvp_votes" (
    "matchId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "openedAt" TIMESTAMPTZ NOT NULL,
    "closesAt" TIMESTAMPTZ NOT NULL,
    "closedAt" TIMESTAMPTZ,
    "decidedBy" TEXT,

    CONSTRAINT "mvp_votes_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "mvp_ballots" (
    "matchId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mvp_ballots_pkey" PRIMARY KEY ("matchId","voterId")
);

-- CreateTable
CREATE TABLE "dues_payments" (
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dues_payments_pkey" PRIMARY KEY ("teamId","playerId","month")
);

-- CreateTable
CREATE TABLE "fund_entries" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMPTZ,
    "deletedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fund_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "matchId" TEXT,
    "view" TEXT,
    "text" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ,
    "pushedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_snapshots" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "job" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ranAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("job","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "login_attempts_key_at_idx" ON "login_attempts"("key", "at");

-- CreateIndex
CREATE UNIQUE INDEX "teams_nameKey_key" ON "teams"("nameKey");

-- CreateIndex
CREATE INDEX "team_captains_userId_idx" ON "team_captains"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "invites_code_key" ON "invites"("code");

-- CreateIndex
CREATE INDEX "invites_teamId_idx" ON "invites"("teamId");

-- CreateIndex
CREATE INDEX "players_teamId_status_idx" ON "players"("teamId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "players_teamId_userId_key" ON "players"("teamId", "userId");

-- CreateIndex
CREATE INDEX "join_requests_teamId_status_idx" ON "join_requests"("teamId", "status");

-- CreateIndex
CREATE INDEX "join_requests_userId_idx" ON "join_requests"("userId");

-- CreateIndex
CREATE INDEX "profile_edits_teamId_status_idx" ON "profile_edits"("teamId", "status");

-- CreateIndex
CREATE INDEX "matches_teamId_date_idx" ON "matches"("teamId", "date");

-- CreateIndex
CREATE INDEX "matches_kickoffAt_idx" ON "matches"("kickoffAt");

-- CreateIndex
CREATE UNIQUE INDEX "claims_matchId_playerId_key" ON "claims"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "mvp_votes_status_closesAt_idx" ON "mvp_votes"("status", "closesAt");

-- CreateIndex
CREATE INDEX "fund_entries_teamId_date_idx" ON "fund_entries"("teamId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "fund_entries_teamId_source_sourceKey_key" ON "fund_entries"("teamId", "source", "sourceKey");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "season_snapshots_teamId_year_key" ON "season_snapshots"("teamId", "year");

-- CreateIndex
CREATE INDEX "audit_logs_teamId_createdAt_idx" ON "audit_logs"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_captains" ADD CONSTRAINT "team_captains_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_captains" ADD CONSTRAINT "team_captains_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_edits" ADD CONSTRAINT "profile_edits_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mvp_votes" ADD CONSTRAINT "mvp_votes_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mvp_ballots" ADD CONSTRAINT "mvp_ballots_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues_payments" ADD CONSTRAINT "dues_payments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues_payments" ADD CONSTRAINT "dues_payments_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_entries" ADD CONSTRAINT "fund_entries_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_snapshots" ADD CONSTRAINT "season_snapshots_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique indexes (ARCHITECTURE 7.2)
-- Mỗi đội chỉ có một mã mời còn hiệu lực
CREATE UNIQUE INDEX "invites_team_active_key" ON "invites"("teamId") WHERE "revokedAt" IS NULL;
-- Chỉ một đơn pending cho mỗi (đội, SĐT)
CREATE UNIQUE INDEX "join_requests_team_phone_pending_key" ON "join_requests"("teamId", "phone") WHERE "status" = 'pending';
-- Mỗi cầu thủ chỉ có một bản cập nhật hồ sơ chờ duyệt
CREATE UNIQUE INDEX "profile_edits_player_pending_key" ON "profile_edits"("playerId") WHERE "status" = 'pending';
-- Thông báo chưa đẩy push
CREATE INDEX "notifications_unpushed_idx" ON "notifications"("createdAt") WHERE "pushedAt" IS NULL;
-- Dữ liệu sạch
ALTER TABLE "players" ADD CONSTRAINT "players_pay_type_check" CHECK ("payType" IN ('quy', 'le'));
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_status_check" CHECK ("status" IN ('di', 'nghi'));
ALTER TABLE "matches" ADD CONSTRAINT "matches_date_check" CHECK ("date" ~ '^\d{4}-\d{2}-\d{2}$');
ALTER TABLE "fund_entries" ADD CONSTRAINT "fund_entries_source_check" CHECK ("source" IN ('dues', 'pitch', 'le', 'manual'));
