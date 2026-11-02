CREATE TABLE "public"."ReferralLeaderboardState" (
    "id" TEXT NOT NULL,
    "initializedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralLeaderboardState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ReferralLeaderboardPosition" (
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "isMegaTop" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralLeaderboardPosition_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "ReferralLeaderboardPosition_rank_idx"
ON "public"."ReferralLeaderboardPosition"("rank");

ALTER TABLE "public"."ReferralLeaderboardPosition"
ADD CONSTRAINT "ReferralLeaderboardPosition_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

WITH attributed_referrals AS (
    SELECT
        u."id" AS "referredUserId",
        COALESCE(fm."userId", u."referredById") AS "referrerId",
        EXISTS (
            SELECT 1
            FROM "public"."Order" o
            WHERE o."buyerId" = u."id"
              AND o."isPaid" = true
        ) AS "hasPaidOrder"
    FROM "public"."User" u
    LEFT JOIN "public"."FieldMarketerSignup" fms
        ON fms."referredUserId" = u."id"
    LEFT JOIN "public"."FieldMarketer" fm
        ON fm."id" = fms."marketerId"
    WHERE (u."referredById" IS NOT NULL OR fm."userId" IS NOT NULL)
      AND COALESCE(fm."userId", u."referredById") <> u."id"
),
referral_totals AS (
    SELECT
        "referrerId",
        COUNT(DISTINCT "referredUserId")::INTEGER AS referrals,
        (COUNT(DISTINCT "referredUserId") FILTER (WHERE "hasPaidOrder"))::INTEGER AS ordered
    FROM attributed_referrals
    WHERE "referrerId" IS NOT NULL
    GROUP BY "referrerId"
),
ranked_referrers AS (
    SELECT
        "referrerId",
        referrals,
        ordered,
        ROW_NUMBER() OVER (
            ORDER BY referrals DESC, ordered DESC, "referrerId" COLLATE "C" ASC
        )::INTEGER AS "rank"
    FROM referral_totals
),
mega_top AS (
    SELECT
        "referrerId",
        ROW_NUMBER() OVER (ORDER BY "rank") AS "megaRank"
    FROM ranked_referrers
    WHERE "rank" <= 10
      AND referrals >= 2
      AND ordered * 100 >= referrals * 20
)
INSERT INTO "public"."ReferralLeaderboardPosition"
    ("userId", "rank", "isMegaTop", "version", "updatedAt")
SELECT
    ranked."referrerId",
    ranked."rank",
    COALESCE(mega."megaRank" <= 3, false),
    0,
    CURRENT_TIMESTAMP
FROM ranked_referrers ranked
LEFT JOIN mega_top mega ON mega."referrerId" = ranked."referrerId"
WHERE ranked."rank" <= 10;

INSERT INTO "public"."ReferralLeaderboardState" ("id")
VALUES ('global');
