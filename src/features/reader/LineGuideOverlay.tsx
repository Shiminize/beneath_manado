import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { ReaderPreferences } from '../../app/types';
import { IconButton } from '../../ui';

interface LineGuideOverlayProps {
  preferences: ReaderPreferences;
  lineGuideAnchors: number[];
  onChange: (preferences: Partial<ReaderPreferences>) => void;
  onStep: (direction: 'next' | 'previous') => void;
}

const LINE_GUIDE_MIN = 10;
const LINE_GUIDE_MAX = 78;
const LINE_GUIDE_ICON_SIZE = 16;
const LINE_GUIDE_ANCHOR_TOLERANCE = 1;

export function LineGuideOverlay({ preferences, lineGuideAnchors, onChange, onStep }: LineGuideOverlayProps) {
  if (!preferences.lineGuideEnabled) return null;

  const lineGuidePosition = clampLineGuidePosition(preferences.lineGuidePosition);
  const currentLineIndex = lineGuideAnchors.findIndex((anchor) => Math.abs(anchor - lineGuidePosition) <= LINE_GUIDE_ANCHOR_TOLERANCE);
  const lineGuideValueText = currentLineIndex >= 0 ? `Line ${currentLineIndex + 1} of ${lineGuideAnchors.length}` : undefined;
  const lineGuideStyle = { '--line-guide-position': `${lineGuidePosition}%` } as CSSProperties;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onStep('previous');
    }
    if (event.key === 'ArrowDown' || event.key === ' ') {
      event.preventDefault();
      onStep('next');
    }
  }

  return (
    <>
      <div className={`line-guide-layer dim-${preferences.lineGuideDimming}`} style={lineGuideStyle}>
        <div className="line-guide-backdrop line-guide-backdrop-top" />
        <div
          className="line-guide-window"
          role="slider"
          aria-label="Line guide position"
          aria-valuemin={LINE_GUIDE_MIN}
          aria-valuemax={LINE_GUIDE_MAX}
          aria-valuenow={Math.round(lineGuidePosition)}
          aria-valuetext={lineGuideValueText}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        />
        <div className="line-guide-backdrop line-guide-backdrop-bottom" />
      </div>

      <div
        className="line-guide-controls"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <IconButton label="Move line guide to previous line" variant="soft" onClick={() => onStep('previous')}>
          <ChevronUp size={LINE_GUIDE_ICON_SIZE} />
        </IconButton>
        <IconButton label="Turn line guide off" variant="soft" onClick={() => onChange({ lineGuideEnabled: false })}>
          <X size={LINE_GUIDE_ICON_SIZE} />
        </IconButton>
        <IconButton label="Move line guide to next line" variant="soft" onClick={() => onStep('next')}>
          <ChevronDown size={LINE_GUIDE_ICON_SIZE} />
        </IconButton>
      </div>
    </>
  );
}

function clampLineGuidePosition(position: number): number {
  return Math.max(LINE_GUIDE_MIN, Math.min(LINE_GUIDE_MAX, position));
}
