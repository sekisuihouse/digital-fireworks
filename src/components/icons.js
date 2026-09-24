/**
 * UI アイコン（インラインSVG / 外部ファイルなし）
 * =========================================================================
 * 画像ファイルを一切使わないので、オフラインでもそのまま動く。
 */

const svg = (inner, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" ${extra}>${inner}</svg>`;

/** UI アイコン */
export const UI_ICONS = {
  play: svg(`<path d="M8 5.4v13.2L19 12 8 5.4Z" fill="currentColor"/>`),
  rocket: svg(`
    <path d="M12 2.6c3.4 2.2 5.2 5.6 5.2 9.3l1.9 2.6-3.1.8-1.3 3.1-2.7-1.9-2.7 1.9-1.3-3.1-3.1-.8 1.9-2.6c0-3.7 1.8-7.1 5.2-9.3Z" fill="currentColor"/>
    <circle cx="12" cy="10" r="1.9" style="fill: var(--strong-bg)"/>`),
  save: svg(`
    <path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>
    <path d="M8.5 4v5h7V4M8 13.5h8V20H8v-6.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`),
  trash: svg(`
    <path d="M4.5 6.5h15M9.5 6.5V4.2h5v2.3M6.8 6.5l.9 13h8.6l.9-13" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`),
  copy: svg(`
    <rect x="8.4" y="8.4" width="11.2" height="11.2" rx="2.2" stroke="currentColor" stroke-width="1.9"/>
    <path d="M15.6 5.6V4.4H4.4v11.2h1.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`),
  undo: svg(`
    <path d="M9.5 8.5H15a4.5 4.5 0 1 1 0 9h-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12.2 5.3 8.6 8.6l3.6 3.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  redo: svg(`
    <path d="M14.5 8.5H9a4.5 4.5 0 1 0 0 9h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M11.8 5.3l3.6 3.3-3.6 3.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  grid: svg(`
    <path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`),
  sound: svg(`
    <path d="M5 9.5h3.2L12.5 6v12L8.2 14.5H5v-5Z" fill="currentColor"/>
    <path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.8a7.5 7.5 0 0 1 0 10.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`),
  mute: svg(`
    <path d="M5 9.5h3.2L12.5 6v12L8.2 14.5H5v-5Z" fill="currentColor"/>
    <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`),
  edit: svg(`
    <path d="M4.5 19.5h4l10-10-4-4-10 10v4Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>
    <path d="M13.5 6.5l4 4" stroke="currentColor" stroke-width="1.9"/>`),
  expand: svg(`
    <path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  close: svg(`<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`),
  reset: svg(`
    <path d="M19 12a7 7 0 1 1-2.6-5.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M19.5 4v4.2h-4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  gallery: svg(`
    <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.4" stroke="currentColor" stroke-width="1.9"/>
    <path d="M3.6 15.4l4.6-4.2 3.6 3.2 3.2-2.8 5.4 4.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="8.6" cy="9.1" r="1.4" fill="currentColor"/>`),
  brush: svg(`
    <path d="M6.5 14.5c-1.8.5-2.4 2.2-2.6 4.6 2.6-.2 4.2-.9 4.7-2.7" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>
    <path d="M9.4 16.1 7.4 14.1 16.9 4.6l2.5 2.5-10 9Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>`),
};

export function uiIcon(name) {
  return UI_ICONS[name] || '';
}
