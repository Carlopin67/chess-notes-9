// ============================================================
// ICONOS PROPIOS — controles e interfaz
// Todo vectorial, ningún emoji ni carácter de teclado.
// ============================================================

function iconSVG(paths, viewBox = '0 0 24 24') {
  return `<svg viewBox="${viewBox}" fill="currentColor">${paths}</svg>`;
}

const ICONS = {
  prev: iconSVG('<polygon points="16,4 16,20 6,12"/>'),
  next: iconSVG('<polygon points="8,4 8,20 18,12"/>'),

  back: iconSVG('<polygon points="16,3 16,21 5,12"/><rect x="7" y="10.5" width="12" height="3" rx="1"/>'),

  add: iconSVG('<rect x="10.5" y="4" width="3" height="16" rx="1.2"/><rect x="4" y="10.5" width="16" height="3" rx="1.2"/>'),

  close: iconSVG(`<rect x="10.5" y="2" width="3" height="20" rx="1.2" transform="rotate(45 12 12)"/>
                  <rect x="10.5" y="2" width="3" height="20" rx="1.2" transform="rotate(-45 12 12)"/>`),

  trash: iconSVG(`<rect x="5" y="7" width="14" height="2.4" rx="1.2"/>
                  <rect x="9.5" y="3" width="5" height="2.4" rx="1.2"/>
                  <path d="M6.5 9.5 L7.6 20 a1.5 1.5 0 0 0 1.5 1.4 h5.8 a1.5 1.5 0 0 0 1.5 -1.4 L17.5 9.5 Z" fill="none" stroke="currentColor" stroke-width="2"/>`),

  settings: iconSVG(`<rect x="3" y="6" width="18" height="2.2" rx="1.1"/>
    <rect x="3" y="15.8" width="18" height="2.2" rx="1.1"/>
    <circle cx="9" cy="7.1" r="3.1" fill="var(--card)" stroke="currentColor" stroke-width="2.2"/>
    <circle cx="15.5" cy="16.9" r="3.1" fill="var(--card)" stroke="currentColor" stroke-width="2.2"/>`),

  exportUp: iconSVG(`<polygon points="12,3 17,9 13.5,9 13.5,16 10.5,16 10.5,9 7,9"/>
    <rect x="5" y="19" width="14" height="2.4" rx="1.2"/>`),

  importDown: iconSVG(`<polygon points="12,17 7,11 10.5,11 10.5,4 13.5,4 13.5,11 17,11"/>
    <rect x="5" y="19" width="14" height="2.4" rx="1.2"/>`),

  contrast: iconSVG(`<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M12 3.4 a8.6 8.6 0 0 1 0 17.2 Z"/>`),

  branch: iconSVG(`<circle cx="7" cy="5.6" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="7" cy="18.4" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="17" cy="5.6" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M7 8 V16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M17 8 v1.8 a4.2 4.2 0 0 1 -4.2 4.2 H9.4" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round"/>`),

  teacher: iconSVG(`<polygon points="12,3.4 22,8.4 12,13.4 2,8.4"/>
    <path d="M6.6 10.2 v4.8 c0 1.9 2.4 3.2 5.4 3.2 s5.4 -1.3 5.4 -3.2 v-4.8"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  pencil: iconSVG(`<path d="M4 20 l0.9 -4.4 L15.2 5.3 l3.5 3.5 L8.4 19.1 Z" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M14 6.5 L17.5 10" fill="none" stroke="currentColor" stroke-width="2"/>`),

  flip: iconSVG(`<path d="M7.5 4.5 L4 8 L7.5 11.5" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 8 H15 a5 5 0 0 1 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M16.5 19.5 L20 16 L16.5 12.5" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M20 16 H9 a5 5 0 0 1 -5 -5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  coords: iconSVG(`<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" fill="none"
      stroke="currentColor" stroke-width="2"/>
    <path d="M3.5 9.2 H20.5 M3.5 14.8 H20.5 M9.2 3.5 V20.5 M14.8 3.5 V20.5"
      fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.75"/>`),

  awake: iconSVG(`<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M12 2.6 v2.6 M12 18.8 v2.6 M21.4 12 h-2.6 M5.2 12 H2.6
              M18.6 5.4 l-1.9 1.9 M7.3 16.7 l-1.9 1.9 M18.6 18.6 l-1.9 -1.9 M7.3 7.3 l-1.9 -1.9"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  piece: iconSVG(`<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.9"/>
    <ellipse cx="12" cy="12" rx="3.7" ry="8.6" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M3.9 9.2 H20.1 M3.9 14.8 H20.1" fill="none" stroke="currentColor" stroke-width="1.6"/>`),

  more: iconSVG(`<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>`),

  search: iconSVG(`<circle cx="10.5" cy="10.5" r="6.2" fill="none" stroke="currentColor" stroke-width="2.2"/>
    <path d="M15.2 15.2 L20.5 20.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`),

  chevron: iconSVG(`<path d="M9.5 5.5 L16 12 L9.5 18.5" fill="none" stroke="currentColor"
    stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`),

  textSize: iconSVG(`<path d="M2.5 18 L6.4 8 L10.3 18 M4 14.6 h4.8"
      fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M13 18.4 L17.5 5.6 L22 18.4 M14.7 14.4 h5.6"
      fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`)
};

function iconButton(name) { return ICONS[name] || ''; }
