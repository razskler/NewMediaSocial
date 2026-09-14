/**
 * Tunable knobs for the "Suggested" feed ranking.
 *
 * score = (1 + likes * likeWeight + comments * commentWeight)
 *         * (followed ? followBoost : 1)
 *         * 2^(-ageHours / recencyHalfLifeHours)
 *
 * Tweak these values to change what the Suggested tab surfaces:
 * - Raise likeWeight/commentWeight to favour engaging posts.
 * - Raise followBoost to push posts from people you follow.
 * - Lower recencyHalfLifeHours to favour fresh posts more aggressively.
 * - candidateWindow is how many recent posts compete for ranking.
 */
export const RANKING_CONFIG = {
  candidateWindow: 200,
  recencyHalfLifeHours: 24,
  likeWeight: 1,
  commentWeight: 1.5,
  followBoost: 3,
} as const;

export function rankScore(
  post: { createdAt: Date; likesCount: number; commentsCount: number },
  isFollowed: boolean,
): number {
  const ageHours = Math.max(
    0,
    (Date.now() - post.createdAt.getTime()) / 3_600_000,
  );
  const freshness = Math.pow(
    2,
    -ageHours / RANKING_CONFIG.recencyHalfLifeHours,
  );
  const engagement =
    1 +
    post.likesCount * RANKING_CONFIG.likeWeight +
    post.commentsCount * RANKING_CONFIG.commentWeight;
  const boost = isFollowed ? RANKING_CONFIG.followBoost : 1;
  return engagement * boost * freshness;
}
