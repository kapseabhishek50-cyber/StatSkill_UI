/**
 * Display helpers. The 0-5 scale and the priority bands are defined server-side
 * in config/competency.js; these labels mirror them for rendering only - the
 * client never decides a level or a band.
 */

export const LEVEL_LABELS = [
  'None',
  'Awareness',
  'Basic',
  'Proficient',
  'Advanced',
  'Expert',
];

export const MAX_LEVEL = 5;

/**
 * Behavioural descriptors for the scale. Display copy only - the authoritative
 * definitions live in server/src/config/competency.js and every level the app
 * stores is decided there. If the two ever disagree, the server is right.
 */
export const LEVEL_DESCRIPTORS = [
  'No exposure to the competency.',
  'Knows the terms and why the work matters; cannot yet do it unaided.',
  'Performs routine tasks under supervision, using standard procedures.',
  'Works independently on standard cases and handles common exceptions.',
  'Handles non-routine cases, reviews others’ work, and adapts method to context.',
  'Sets method and standards for others; the reference point in the organisation.',
];


export function levelLabel(level) {
  return LEVEL_LABELS[level] ?? 'Unrated';
}

/** "Level 3 - Proficient", the form used wherever a bare number would be opaque. */
export function levelText(level) {
  return `Level ${level} · ${levelLabel(level)}`;
}

export function percent(ratio, digits = 0) {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/**
 * Band -> status role. These are the reserved status colours, so every use of one
 * ships an icon and the band word beside it; colour never carries the band alone.
 */
export const BAND_STATUS = {
  critical: { role: 'critical', label: 'Critical' },
  high: { role: 'serious', label: 'High' },
  moderate: { role: 'warning', label: 'Moderate' },
  low: { role: 'good', label: 'Low' },
};

export function bandMeta(band) {
  return BAND_STATUS[band] ?? { role: 'good', label: 'None' };
}

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Truncate for a chart axis, where a full competency name will not fit. */
export function shorten(text, limit = 22) {
  const clean = String(text ?? '');
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

/** Maps a 0..1 magnitude onto the five sequential steps. */
export function seqStep(value) {
  if (!value || value <= 0) return 0;
  return Math.min(5, Math.ceil(value * 5));
}
