import { levelLabel } from '../lib/format.js';

export default function CompetencyMeter({
  name,
  category,
  currentLevel = 0,
  requiredLevel = null,
  compact = false,
}) {
  const max = 5;
  const currentPct = Math.min(100, Math.max(0, (currentLevel / max) * 100));
  const requiredPct = requiredLevel !== null ? Math.min(100, Math.max(0, (requiredLevel / max) * 100)) : null;

  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-ink truncate">{name}</span>
          {category && <span className="text-[10px] font-medium text-ink-muted px-1.5 py-0.5 rounded border border-hairline bg-plane shrink-0">{category}</span>}
        </div>
        <div className="flex items-center gap-1.5 font-medium text-ink-2 shrink-0">
          <span className="text-primary font-bold">{levelLabel(currentLevel)}</span>
          {requiredLevel !== null && (
            <span className="text-ink-muted">/ Req: {levelLabel(requiredLevel)}</span>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="relative h-1.5 w-full rounded-pill bg-surface-2 overflow-hidden">
        {/* Fill bar — solid professional blue */}
        <div
          className="h-full rounded-pill bg-primary transition-all duration-200 ease-out"
          style={{ width: `${currentPct}%` }}
        />

        {/* Required Level Marker */}
        {requiredPct !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-navy z-10"
            style={{ left: `${requiredPct}%` }}
            title={`Required Level: ${levelLabel(requiredLevel)}`}
          />
        )}
      </div>
    </div>
  );
}
