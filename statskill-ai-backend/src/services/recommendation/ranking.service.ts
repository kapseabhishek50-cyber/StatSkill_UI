import { ScoreBreakdown } from './scoring.service';

export interface RankedCandidate {
  courseId: string;
  course: unknown;
  skillCode: string | null;
  skillName: string | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  scores: ScoreBreakdown;
}

/**
 * Ranking (prompt §7/§8): sort by weighted final score desc, tie-break by gap
 * then priority. The AI NEVER re-ranks — it only explains the output of this
 * deterministic ranking.
 */
const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const rankCandidates = (
  candidates: RankedCandidate[],
  topN: number
): RankedCandidate[] =>
  [...candidates]
    .sort((a, b) => {
      const byScore = b.scores.final - a.scores.final;
      if (Math.abs(byScore) > 1e-9) return byScore;
      const byGap = b.scores.gap - a.scores.gap;
      if (Math.abs(byGap) > 1e-9) return byGap;
      return (
        (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
      );
    })
    .slice(0, topN);

export const matchScorePercent = (final: number): number => Math.round(final * 100);
