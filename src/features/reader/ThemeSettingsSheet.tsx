import { AlignJustify, Bold, ChevronDown, FileText, Minus, Plus, Sun, Type } from 'lucide-react';
import type { ReaderPreferences, ReaderTheme } from '../../app/types';
import { Sheet } from '../../ui';

interface ThemeSettingsSheetProps {
  preferences: ReaderPreferences;
  onChange: (preferences: Partial<ReaderPreferences>) => void;
  onClose: () => void;
}

const themes: { value: ReaderTheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'contrast', label: 'High Contrast' }
];

const fontOptions: { value: ReaderPreferences['fontFamily']; label: string }[] = [
  { value: 'theme', label: 'Theme Default' },
  { value: 'literata', label: 'Literata' },
  { value: 'source-serif', label: 'Source Serif' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'georgia', label: 'Georgia' },
  { value: 'palatino', label: 'Palatino' }
];

const SETTINGS_ICON_SIZE = 16;
const SETTINGS_TYPE_ICON_SIZE = 18;
const FONT_SIZE_MIN = 16;
const FONT_SIZE_MAX = 28;
const FONT_SIZE_DOTS = 10;
const pageTurnOptions: { value: Extract<ReaderPreferences['pageTurnMode'], 'fade' | 'scroll'>; label: string }[] = [
  { value: 'fade', label: 'Fast Fade' },
  { value: 'scroll', label: 'Scroll' }
];

export function ThemeSettingsSheet({ preferences, onChange, onClose }: ThemeSettingsSheetProps) {
  const fontSizeLevel = getFontSizeLevel(preferences.fontSize);

  return (
    <Sheet title="Themes & Settings" titleId="theme-settings-title" className="settings-sheet" closeLabel="Close themes and settings" onClose={onClose}>
        <div className="font-size-control">
          <div className="segmented-control font-size-stepper" aria-label="Font size">
            <button type="button" aria-label="Decrease font size" onClick={() => onChange({ fontSize: Math.max(FONT_SIZE_MIN, preferences.fontSize - 1) })}>
              <Minus size={SETTINGS_ICON_SIZE} aria-hidden="true" />
              <Type size={SETTINGS_ICON_SIZE} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Increase font size" onClick={() => onChange({ fontSize: Math.min(FONT_SIZE_MAX, preferences.fontSize + 1) })}>
              <Plus size={SETTINGS_ICON_SIZE} aria-hidden="true" />
              <Type size={SETTINGS_TYPE_ICON_SIZE} aria-hidden="true" />
            </button>
          </div>
          <div className="font-size-dots" aria-label={`Font size level ${fontSizeLevel} of ${FONT_SIZE_DOTS}`}>
            {Array.from({ length: FONT_SIZE_DOTS }, (_, index) => (
              <span key={index} className={index < fontSizeLevel ? 'font-size-dot filled' : 'font-size-dot'} />
            ))}
          </div>
        </div>

        <div className="setting-row">
          <Sun size={SETTINGS_ICON_SIZE} aria-hidden="true" />
          <input
            aria-label="Brightness"
            name="brightness"
            type="range"
            min="0.72"
            max="1.08"
            step="0.02"
            value={preferences.brightness}
            onChange={(event) => onChange({ brightness: Number(event.target.value) })}
          />
        </div>

        <div className="page-turn-row" aria-label="Page turn style">
          {pageTurnOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={preferences.pageTurnMode === value ? 'page-turn-button active' : 'page-turn-button'}
              onClick={() => onChange({ pageTurnMode: value })}
            >
              <FileText size={SETTINGS_ICON_SIZE} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <section className="settings-section" aria-labelledby="page-theme-heading">
          <div className="settings-section-label" id="page-theme-heading">
            <Type size={SETTINGS_ICON_SIZE} aria-hidden="true" />
            <span>Page Theme</span>
          </div>
          <div className="theme-grid">
            {themes.map((theme) => (
              <button
                key={theme.value}
                type="button"
                aria-pressed={preferences.theme === theme.value}
                className={preferences.theme === theme.value ? `theme-card ${theme.value} active` : `theme-card ${theme.value}`}
                onClick={() => onChange({ theme: theme.value })}
              >
                <span>Aa</span>
                <small>{theme.label}</small>
              </button>
            ))}
          </div>
        </section>

        <details className="customize-panel" open>
          <summary>
            <Type size={SETTINGS_ICON_SIZE} aria-hidden="true" />
            Customize
            <ChevronDown size={SETTINGS_ICON_SIZE} aria-hidden="true" />
          </summary>

          <div className="customize-grid">
            <label>
              Font
              <select name="font-family" value={preferences.fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value as ReaderPreferences['fontFamily'] })}>
                {fontOptions.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" className={preferences.boldText ? 'toggle-button active' : 'toggle-button'} onClick={() => onChange({ boldText: !preferences.boldText })}>
              <Bold size={SETTINGS_ICON_SIZE} aria-hidden="true" />
              Bold Text
            </button>

            <label>
              Line Spacing
              <input name="line-spacing" type="range" min="1.45" max="1.95" step="0.05" value={preferences.lineHeight} onChange={(event) => onChange({ lineHeight: Number(event.target.value) })} />
            </label>

            <label>
              Character Spacing
              <input name="character-spacing" type="range" min="0" max="0.08" step="0.01" value={preferences.characterSpacing} onChange={(event) => onChange({ characterSpacing: Number(event.target.value) })} />
            </label>

            <label>
              Word Spacing
              <input name="word-spacing" type="range" min="0" max="0.28" step="0.02" value={preferences.wordSpacing} onChange={(event) => onChange({ wordSpacing: Number(event.target.value) })} />
            </label>

            <label>
              Margins
              <input name="reader-margins" type="range" min="0.8" max="1.3" step="0.05" value={preferences.marginScale} onChange={(event) => onChange({ marginScale: Number(event.target.value) })} />
            </label>

            <button type="button" className={preferences.justifyText ? 'toggle-button active' : 'toggle-button'} onClick={() => onChange({ justifyText: !preferences.justifyText })}>
              <AlignJustify size={SETTINGS_ICON_SIZE} aria-hidden="true" />
              Justify Text
            </button>
          </div>
        </details>
    </Sheet>
  );
}

function getFontSizeLevel(fontSize: number) {
  const normalized = (Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, fontSize)) - FONT_SIZE_MIN) / (FONT_SIZE_MAX - FONT_SIZE_MIN);
  return Math.max(1, Math.min(FONT_SIZE_DOTS, Math.round(normalized * (FONT_SIZE_DOTS - 1)) + 1));
}
