import { Competency } from '../../models/Competency';
import { IExtractedSkill } from '../../models/User';

export interface CvMatch extends IExtractedSkill {
  competencyCode?: string;
  competencyName?: string;
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** First sentence-ish fragment containing any of the keywords (for evidence display). */
const findEvidence = (text: string, keywords: string[]): string | undefined => {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx === -1) continue;
    const start = Math.max(0, text.lastIndexOf('.', idx - 120) + 1);
    const end = text.indexOf('.', idx + 60);
    const fragment = text.slice(start, end === -1 ? start + 160 : Math.min(end, start + 160)).trim();
    if (fragment) return fragment.length > 160 ? `${fragment.slice(0, 157)}…` : fragment;
  }
  return undefined;
};

/**
 * Deterministic CV → competency matching. Counts keyword hits per competency
 * and converts them into a 0–5 *suggestion* (impliedLevel) plus confidence.
 * These are suggestions only — they never write a recorded competency level.
 */
export const matchCompetencies = async (text: string, limit = 10): Promise<CvMatch[]> => {
  const competencies = await Competency.find({ isActive: true });
  const cleaned = text.replace(/\s+/g, ' ');
  const scored: CvMatch[] = [];

  for (const comp of competencies) {
    const terms = [comp.name, comp.code.replace(/_/g, ' '), ...comp.keywords].filter(Boolean);
    let hits = 0;
    const hitTerms: string[] = [];
    for (const term of terms) {
      const pattern = new RegExp(`\\b${escapeRegex(term.toLowerCase())}\\b`, 'g');
      const matches = cleaned.toLowerCase().match(pattern);
      if (matches?.length) {
        hits += matches.length;
        hitTerms.push(term);
      }
    }
    if (hits === 0) continue;
    scored.push({
      term: comp.name,
      competency: comp._id,
      competencyCode: comp.code,
      competencyName: comp.name,
      impliedLevel: Math.max(1, Math.min(4, 1 + Math.floor(hits / 2))),
      confidence: Math.min(0.92, 0.35 + 0.12 * hits),
      evidence: findEvidence(cleaned, hitTerms),
    });
  }

  return scored
    .sort((a, b) => b.confidence - a.confidence || a.term.localeCompare(b.term))
    .slice(0, limit);
};
