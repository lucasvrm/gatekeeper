// ============================================================================
// Component Thumbnails — SVG data URIs for the Easyblocks component palette
//
// Each thumbnail is a 120×80 SVG rendered as a data URI.
// Grouped by category matching the definition files.
// ============================================================================

function svg(body: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">${body}</svg>`
  )}`;
}

// Shared palette
const BG = "#1c1c21";
const FG = "#e4e4e7";
const MUTED = "#5b5b66";
const ACCENT = "#6d9cff";
const BORDER = "#2a2a33";
const SUCCESS = "#4ade80";
const DANGER = "#ff6b6b";
const WARNING = "#fbbf24";

// ============================================================================
// Layout (6)
// ============================================================================

/** Stack — vertical bars */
export const THUMB_STACK = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="20" y="10" width="80" height="14" rx="2" fill="${ACCENT}" opacity="0.3"/>` +
  `<rect x="20" y="30" width="80" height="14" rx="2" fill="${ACCENT}" opacity="0.5"/>` +
  `<rect x="20" y="50" width="80" height="14" rx="2" fill="${ACCENT}" opacity="0.7"/>`
);

/** Row — horizontal blocks */
export const THUMB_ROW = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="10" y="22" width="28" height="36" rx="3" fill="${ACCENT}" opacity="0.4"/>` +
  `<rect x="44" y="22" width="28" height="36" rx="3" fill="${ACCENT}" opacity="0.6"/>` +
  `<rect x="78" y="22" width="28" height="36" rx="3" fill="${ACCENT}" opacity="0.8"/>`
);

/** Grid — 2x2 */
export const THUMB_GRID = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="12" y="10" width="42" height="25" rx="2" fill="${ACCENT}" opacity="0.35"/>` +
  `<rect x="62" y="10" width="42" height="25" rx="2" fill="${ACCENT}" opacity="0.5"/>` +
  `<rect x="12" y="42" width="42" height="25" rx="2" fill="${ACCENT}" opacity="0.65"/>` +
  `<rect x="62" y="42" width="42" height="25" rx="2" fill="${ACCENT}" opacity="0.8"/>`
);

/** Container — outlined box */
export const THUMB_CONTAINER = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="15" y="12" width="90" height="56" rx="4" fill="none" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="4 2"/>` +
  `<rect x="30" y="28" width="60" height="24" rx="2" fill="${ACCENT}" opacity="0.2"/>`
);

/** Accordion — collapsible sections */
export const THUMB_ACCORDION = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="15" y="10" width="90" height="16" rx="2" fill="${BORDER}"/>` +
  `<text x="22" y="21" font-size="8" fill="${FG}" font-family="sans-serif">▸ Section 1</text>` +
  `<rect x="15" y="30" width="90" height="16" rx="2" fill="${ACCENT}" opacity="0.25"/>` +
  `<text x="22" y="41" font-size="8" fill="${ACCENT}" font-family="sans-serif">▾ Section 2</text>` +
  `<rect x="15" y="48" width="90" height="10" rx="1" fill="${BORDER}" opacity="0.5"/>` +
  `<rect x="15" y="62" width="90" height="16" rx="2" fill="${BORDER}"/>` +
  `<text x="22" y="73" font-size="8" fill="${FG}" font-family="sans-serif">▸ Section 3</text>`
);

/** Sidebar — side panel layout */
export const THUMB_SIDEBAR = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="8" y="8" width="32" height="64" rx="3" fill="${ACCENT}" opacity="0.2"/>` +
  `<rect x="12" y="16" width="24" height="3" rx="1" fill="${ACCENT}" opacity="0.6"/>` +
  `<rect x="12" y="24" width="20" height="3" rx="1" fill="${MUTED}"/>` +
  `<rect x="12" y="32" width="22" height="3" rx="1" fill="${MUTED}"/>` +
  `<rect x="46" y="8" width="66" height="64" rx="3" fill="${BORDER}" opacity="0.5"/>`
);

// ============================================================================
// Content (8)
// ============================================================================

/** Heading — large text */
export const THUMB_HEADING = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<text x="16" y="36" font-size="18" font-weight="700" fill="${FG}" font-family="sans-serif">Aa</text>` +
  `<rect x="16" y="46" width="50" height="2" rx="1" fill="${MUTED}"/>` +
  `<rect x="16" y="54" width="36" height="2" rx="1" fill="${MUTED}" opacity="0.5"/>`
);

/** Text — paragraph */
export const THUMB_TEXT = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="16" y="18" width="88" height="3" rx="1" fill="${MUTED}"/>` +
  `<rect x="16" y="26" width="82" height="3" rx="1" fill="${MUTED}"/>` +
  `<rect x="16" y="34" width="70" height="3" rx="1" fill="${MUTED}"/>` +
  `<rect x="16" y="46" width="86" height="3" rx="1" fill="${MUTED}" opacity="0.6"/>` +
  `<rect x="16" y="54" width="60" height="3" rx="1" fill="${MUTED}" opacity="0.6"/>`
);

/** Button */
export const THUMB_BUTTON = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="24" y="26" width="72" height="28" rx="6" fill="${ACCENT}"/>` +
  `<text x="60" y="44" text-anchor="middle" font-size="11" font-weight="600" fill="#fff" font-family="sans-serif">Botão</text>`
);

/** Badge */
export const THUMB_BADGE = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="30" y="28" width="60" height="24" rx="12" fill="${ACCENT}" opacity="0.15"/>` +
  `<text x="60" y="44" text-anchor="middle" font-size="10" font-weight="600" fill="${ACCENT}" font-family="sans-serif">Status</text>`
);

/** Icon — star icon */
export const THUMB_ICON = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<polygon points="60,18 66,34 84,34 70,44 75,60 60,50 45,60 50,44 36,34 54,34" fill="${ACCENT}" opacity="0.7"/>`
);

/** Image — landscape placeholder */
export const THUMB_IMAGE = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="20" y="14" width="80" height="52" rx="4" fill="${BORDER}"/>` +
  `<circle cx="40" cy="32" r="7" fill="${ACCENT}" opacity="0.4"/>` +
  `<polygon points="30,56 55,36 75,50 85,42 100,56" fill="${ACCENT}" opacity="0.3"/>`
);

/** Divider — horizontal line */
export const THUMB_DIVIDER = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<line x1="16" y1="40" x2="104" y2="40" stroke="${MUTED}" stroke-width="1.5"/>`
);

/** Spacer — empty space indicator */
export const THUMB_SPACER = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<line x1="60" y1="16" x2="60" y2="28" stroke="${MUTED}" stroke-width="1" stroke-dasharray="2 2"/>` +
  `<line x1="30" y1="28" x2="90" y2="28" stroke="${MUTED}" stroke-width="1"/>` +
  `<text x="60" y="44" text-anchor="middle" font-size="9" fill="${MUTED}" font-family="sans-serif">↕</text>` +
  `<line x1="30" y1="52" x2="90" y2="52" stroke="${MUTED}" stroke-width="1"/>` +
  `<line x1="60" y1="52" x2="60" y2="64" stroke="${MUTED}" stroke-width="1" stroke-dasharray="2 2"/>`
);

// ============================================================================
// Data (5)
// ============================================================================

/** StatCard — number with label */
export const THUMB_STAT_CARD = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="12" y="10" width="96" height="60" rx="6" fill="${BORDER}"/>` +
  `<text x="24" y="32" font-size="8" fill="${ACCENT}" font-family="sans-serif">Total</text>` +
  `<text x="24" y="52" font-size="18" font-weight="700" fill="${FG}" font-family="sans-serif">1,234</text>`
);

/** Card — bordered card */
export const THUMB_CARD = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="16" y="8" width="88" height="64" rx="6" fill="${BORDER}"/>` +
  `<rect x="16" y="8" width="88" height="28" rx="6" fill="${ACCENT}" opacity="0.15"/>` +
  `<rect x="24" y="44" width="50" height="4" rx="1" fill="${FG}" opacity="0.7"/>` +
  `<rect x="24" y="54" width="36" height="3" rx="1" fill="${MUTED}"/>` +
  `<rect x="24" y="62" width="42" height="3" rx="1" fill="${MUTED}" opacity="0.5"/>`
);

/** Table — rows and columns */
export const THUMB_TABLE = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="8" y="10" width="104" height="14" rx="2" fill="${ACCENT}" opacity="0.15"/>` +
  `<text x="16" y="20" font-size="7" font-weight="600" fill="${ACCENT}" font-family="sans-serif">NOME</text>` +
  `<text x="56" y="20" font-size="7" font-weight="600" fill="${ACCENT}" font-family="sans-serif">STATUS</text>` +
  `<text x="92" y="20" font-size="7" font-weight="600" fill="${ACCENT}" font-family="sans-serif">DATA</text>` +
  `<line x1="8" y1="27" x2="112" y2="27" stroke="${BORDER}" stroke-width="0.5"/>` +
  `<rect x="16" y="31" width="30" height="3" rx="1" fill="${MUTED}"/>` +
  `<rect x="56" y="31" width="20" height="3" rx="1" fill="${MUTED}"/>` +
  `<rect x="92" y="31" width="16" height="3" rx="1" fill="${MUTED}"/>` +
  `<line x1="8" y1="39" x2="112" y2="39" stroke="${BORDER}" stroke-width="0.5"/>` +
  `<rect x="16" y="43" width="26" height="3" rx="1" fill="${MUTED}" opacity="0.6"/>` +
  `<rect x="56" y="43" width="18" height="3" rx="1" fill="${MUTED}" opacity="0.6"/>` +
  `<rect x="92" y="43" width="16" height="3" rx="1" fill="${MUTED}" opacity="0.6"/>` +
  `<line x1="8" y1="51" x2="112" y2="51" stroke="${BORDER}" stroke-width="0.5"/>` +
  `<rect x="16" y="55" width="32" height="3" rx="1" fill="${MUTED}" opacity="0.4"/>` +
  `<rect x="56" y="55" width="22" height="3" rx="1" fill="${MUTED}" opacity="0.4"/>` +
  `<rect x="92" y="55" width="16" height="3" rx="1" fill="${MUTED}" opacity="0.4"/>`
);

/** List — vertical items */
export const THUMB_LIST = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<circle cx="22" cy="20" r="3" fill="${ACCENT}" opacity="0.5"/>` +
  `<rect x="32" y="18" width="70" height="4" rx="1" fill="${MUTED}"/>` +
  `<circle cx="22" cy="36" r="3" fill="${ACCENT}" opacity="0.5"/>` +
  `<rect x="32" y="34" width="62" height="4" rx="1" fill="${MUTED}"/>` +
  `<circle cx="22" cy="52" r="3" fill="${ACCENT}" opacity="0.5"/>` +
  `<rect x="32" y="50" width="56" height="4" rx="1" fill="${MUTED}"/>` +
  `<circle cx="22" cy="68" r="3" fill="${ACCENT}" opacity="0.5"/>` +
  `<rect x="32" y="66" width="66" height="4" rx="1" fill="${MUTED}" opacity="0.4"/>`
);

/** KeyValue — label: value pairs */
export const THUMB_KEY_VALUE = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<text x="16" y="24" font-size="8" fill="${MUTED}" font-family="sans-serif">Nome</text>` +
  `<text x="70" y="24" font-size="8" fill="${FG}" font-family="sans-serif">Valor</text>` +
  `<line x1="16" y1="30" x2="104" y2="30" stroke="${BORDER}" stroke-width="0.5"/>` +
  `<text x="16" y="42" font-size="8" fill="${MUTED}" font-family="sans-serif">Status</text>` +
  `<text x="70" y="42" font-size="8" fill="${SUCCESS}" font-family="sans-serif">Ativo</text>` +
  `<line x1="16" y1="48" x2="104" y2="48" stroke="${BORDER}" stroke-width="0.5"/>` +
  `<text x="16" y="60" font-size="8" fill="${MUTED}" font-family="sans-serif">Data</text>` +
  `<text x="70" y="60" font-size="8" fill="${FG}" font-family="sans-serif">04/02</text>`
);

// ============================================================================
// Navigation (5)
// ============================================================================

/** Tabs */
export const THUMB_TABS = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="10" y="18" width="36" height="18" rx="3" fill="${ACCENT}" opacity="0.2"/>` +
  `<text x="28" y="30" text-anchor="middle" font-size="8" font-weight="600" fill="${ACCENT}" font-family="sans-serif">Tab 1</text>` +
  `<text x="68" y="30" text-anchor="middle" font-size="8" fill="${MUTED}" font-family="sans-serif">Tab 2</text>` +
  `<text x="102" y="30" text-anchor="middle" font-size="8" fill="${MUTED}" font-family="sans-serif">Tab 3</text>` +
  `<line x1="10" y1="38" x2="110" y2="38" stroke="${BORDER}" stroke-width="1"/>` +
  `<rect x="10" y="44" width="100" height="4" rx="1" fill="${MUTED}" opacity="0.3"/>` +
  `<rect x="10" y="52" width="80" height="4" rx="1" fill="${MUTED}" opacity="0.2"/>`
);

/** Breadcrumb — path trail */
export const THUMB_BREADCRUMB = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<text x="12" y="43" font-size="9" fill="${MUTED}" font-family="sans-serif">Home</text>` +
  `<text x="40" y="43" font-size="9" fill="${MUTED}" font-family="sans-serif">/</text>` +
  `<text x="48" y="43" font-size="9" fill="${MUTED}" font-family="sans-serif">Docs</text>` +
  `<text x="72" y="43" font-size="9" fill="${MUTED}" font-family="sans-serif">/</text>` +
  `<text x="80" y="43" font-size="9" font-weight="600" fill="${FG}" font-family="sans-serif">Page</text>`
);

/** Pagination — page numbers */
export const THUMB_PAGINATION = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<text x="18" y="44" font-size="10" fill="${MUTED}" font-family="sans-serif">‹</text>` +
  `<rect x="28" y="32" width="18" height="18" rx="3" fill="${ACCENT}"/>` +
  `<text x="37" y="44" text-anchor="middle" font-size="9" font-weight="600" fill="#fff" font-family="sans-serif">1</text>` +
  `<text x="57" y="44" text-anchor="middle" font-size="9" fill="${MUTED}" font-family="sans-serif">2</text>` +
  `<text x="74" y="44" text-anchor="middle" font-size="9" fill="${MUTED}" font-family="sans-serif">3</text>` +
  `<text x="91" y="44" text-anchor="middle" font-size="9" fill="${MUTED}" font-family="sans-serif">…</text>` +
  `<text x="104" y="44" font-size="10" fill="${MUTED}" font-family="sans-serif">›</text>`
);

/** NavMenu — menu items */
export const THUMB_NAV_MENU = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="14" y="14" width="92" height="12" rx="2" fill="${ACCENT}" opacity="0.15"/>` +
  `<rect x="20" y="17" width="30" height="6" rx="1" fill="${ACCENT}" opacity="0.5"/>` +
  `<rect x="14" y="30" width="92" height="12" rx="2" fill="${BORDER}" opacity="0.4"/>` +
  `<rect x="20" y="33" width="36" height="6" rx="1" fill="${MUTED}"/>` +
  `<rect x="14" y="46" width="92" height="12" rx="2" fill="${BORDER}" opacity="0.4"/>` +
  `<rect x="20" y="49" width="28" height="6" rx="1" fill="${MUTED}"/>` +
  `<rect x="14" y="62" width="92" height="12" rx="2" fill="${BORDER}" opacity="0.4"/>` +
  `<rect x="20" y="65" width="40" height="6" rx="1" fill="${MUTED}"/>`
);

/** Link — underlined text */
export const THUMB_LINK = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<text x="60" y="38" text-anchor="middle" font-size="12" fill="${ACCENT}" font-family="sans-serif">Link →</text>` +
  `<line x1="32" y1="42" x2="88" y2="42" stroke="${ACCENT}" stroke-width="1" opacity="0.5"/>`
);

// ============================================================================
// Input / Forms (7)
// ============================================================================

/** Search — search bar */
export const THUMB_SEARCH = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="14" y="26" width="92" height="28" rx="6" fill="${BORDER}"/>` +
  `<circle cx="32" cy="40" r="6" fill="none" stroke="${MUTED}" stroke-width="1.5"/>` +
  `<line x1="36" y1="44" x2="40" y2="48" stroke="${MUTED}" stroke-width="1.5"/>` +
  `<text x="48" y="43" font-size="9" fill="${MUTED}" font-family="sans-serif">Buscar...</text>`
);

/** Select — dropdown */
export const THUMB_SELECT = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="14" y="26" width="92" height="28" rx="4" fill="${BORDER}"/>` +
  `<text x="24" y="44" font-size="9" fill="${FG}" font-family="sans-serif">Selecione</text>` +
  `<text x="94" y="44" font-size="10" fill="${MUTED}" font-family="sans-serif">▾</text>`
);

/** Input — text field */
export const THUMB_INPUT = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<text x="14" y="24" font-size="8" fill="${MUTED}" font-family="sans-serif">Campo</text>` +
  `<rect x="14" y="30" width="92" height="26" rx="4" fill="none" stroke="${BORDER}" stroke-width="1.5"/>` +
  `<text x="22" y="46" font-size="9" fill="${MUTED}" opacity="0.6" font-family="sans-serif">Digite aqui...</text>`
);

/** Textarea — multi-line */
export const THUMB_TEXTAREA = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<text x="14" y="18" font-size="8" fill="${MUTED}" font-family="sans-serif">Mensagem</text>` +
  `<rect x="14" y="22" width="92" height="48" rx="4" fill="none" stroke="${BORDER}" stroke-width="1.5"/>` +
  `<rect x="22" y="30" width="60" height="3" rx="1" fill="${MUTED}" opacity="0.3"/>` +
  `<rect x="22" y="38" width="50" height="3" rx="1" fill="${MUTED}" opacity="0.2"/>` +
  `<rect x="22" y="46" width="40" height="3" rx="1" fill="${MUTED}" opacity="0.15"/>`
);

/** Checkbox */
export const THUMB_CHECKBOX = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="20" y="30" width="18" height="18" rx="3" fill="${ACCENT}"/>` +
  `<polyline points="24,39 28,43 34,34" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<text x="46" y="43" font-size="10" fill="${FG}" font-family="sans-serif">Opção</text>`
);

/** Switch — toggle */
export const THUMB_SWITCH = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="20" y="29" width="36" height="20" rx="10" fill="${ACCENT}"/>` +
  `<circle cx="44" cy="39" r="7" fill="#fff"/>` +
  `<text x="64" y="43" font-size="10" fill="${FG}" font-family="sans-serif">Ativo</text>`
);

/** Radio — radio buttons */
export const THUMB_RADIO = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<circle cx="28" cy="24" r="7" fill="none" stroke="${ACCENT}" stroke-width="1.5"/>` +
  `<circle cx="28" cy="24" r="3.5" fill="${ACCENT}"/>` +
  `<text x="42" y="27" font-size="9" fill="${FG}" font-family="sans-serif">Opção 1</text>` +
  `<circle cx="28" cy="44" r="7" fill="none" stroke="${MUTED}" stroke-width="1.5"/>` +
  `<text x="42" y="47" font-size="9" fill="${MUTED}" font-family="sans-serif">Opção 2</text>` +
  `<circle cx="28" cy="64" r="7" fill="none" stroke="${MUTED}" stroke-width="1.5"/>` +
  `<text x="42" y="67" font-size="9" fill="${MUTED}" font-family="sans-serif">Opção 3</text>`
);

// ============================================================================
// Special (1)
// ============================================================================

/** Slot — placeholder */
export const THUMB_SLOT = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="16" y="12" width="88" height="56" rx="4" fill="none" stroke="${MUTED}" stroke-width="1" stroke-dasharray="6 3"/>` +
  `<text x="60" y="38" text-anchor="middle" font-size="20" fill="${MUTED}" font-family="sans-serif">+</text>` +
  `<text x="60" y="52" text-anchor="middle" font-size="8" fill="${MUTED}" font-family="sans-serif">Slot</text>`
);

// ============================================================================
// Feedback (4)
// ============================================================================

/** Alert — notification banner */
export const THUMB_ALERT = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="12" y="20" width="96" height="40" rx="6" fill="${ACCENT}" opacity="0.1" stroke="${ACCENT}" stroke-width="1"/>` +
  `<circle cx="28" cy="34" r="6" fill="${ACCENT}" opacity="0.3"/>` +
  `<text x="28" y="37" text-anchor="middle" font-size="9" font-weight="700" fill="${ACCENT}" font-family="sans-serif">!</text>` +
  `<rect x="40" y="31" width="56" height="4" rx="1" fill="${ACCENT}" opacity="0.5"/>` +
  `<rect x="40" y="40" width="40" height="3" rx="1" fill="${MUTED}" opacity="0.4"/>`
);

/** Progress — progress bar */
export const THUMB_PROGRESS = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<text x="16" y="30" font-size="8" fill="${MUTED}" font-family="sans-serif">Progresso</text>` +
  `<rect x="16" y="36" width="88" height="8" rx="4" fill="${BORDER}"/>` +
  `<rect x="16" y="36" width="60" height="8" rx="4" fill="${ACCENT}"/>` +
  `<text x="84" y="58" font-size="9" fill="${MUTED}" font-family="sans-serif">68%</text>`
);

/** Spinner — loading indicator */
export const THUMB_SPINNER = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<circle cx="60" cy="40" r="16" fill="none" stroke="${BORDER}" stroke-width="3"/>` +
  `<path d="M60,24 A16,16 0 0,1 76,40" fill="none" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round"/>`
);

/** Skeleton — loading placeholder */
export const THUMB_SKELETON = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="16" y="14" width="40" height="40" rx="4" fill="${BORDER}">` +
    `<animate attributeName="opacity" values="0.3;0.6;0.3" dur="1.5s" repeatCount="indefinite"/>` +
  `</rect>` +
  `<rect x="64" y="16" width="40" height="6" rx="2" fill="${BORDER}">` +
    `<animate attributeName="opacity" values="0.3;0.6;0.3" dur="1.5s" repeatCount="indefinite"/>` +
  `</rect>` +
  `<rect x="64" y="28" width="32" height="6" rx="2" fill="${BORDER}">` +
    `<animate attributeName="opacity" values="0.3;0.6;0.3" dur="1.5s" repeatCount="indefinite"/>` +
  `</rect>` +
  `<rect x="16" y="62" width="88" height="6" rx="2" fill="${BORDER}">` +
    `<animate attributeName="opacity" values="0.3;0.6;0.3" dur="1.5s" repeatCount="indefinite"/>` +
  `</rect>`
);

// ============================================================================
// Overlay (3)
// ============================================================================

/** Modal — dialog box */
export const THUMB_MODAL = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect width="120" height="80" rx="4" fill="#000" opacity="0.4"/>` +
  `<rect x="18" y="12" width="84" height="56" rx="6" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>` +
  `<rect x="26" y="20" width="40" height="5" rx="1" fill="${FG}" opacity="0.7"/>` +
  `<text x="90" y="24" text-anchor="middle" font-size="12" fill="${MUTED}" font-family="sans-serif">×</text>` +
  `<rect x="26" y="32" width="68" height="3" rx="1" fill="${MUTED}" opacity="0.4"/>` +
  `<rect x="26" y="40" width="52" height="3" rx="1" fill="${MUTED}" opacity="0.3"/>` +
  `<rect x="60" y="52" width="34" height="12" rx="4" fill="${ACCENT}"/>` +
  `<text x="77" y="61" text-anchor="middle" font-size="7" fill="#fff" font-family="sans-serif">OK</text>`
);

/** Drawer — side panel overlay */
export const THUMB_DRAWER = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect width="120" height="80" rx="4" fill="#000" opacity="0.3"/>` +
  `<rect x="40" y="0" width="80" height="80" rx="4" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>` +
  `<rect x="50" y="14" width="50" height="5" rx="1" fill="${FG}" opacity="0.7"/>` +
  `<rect x="50" y="28" width="60" height="3" rx="1" fill="${MUTED}" opacity="0.4"/>` +
  `<rect x="50" y="38" width="44" height="3" rx="1" fill="${MUTED}" opacity="0.3"/>` +
  `<rect x="50" y="48" width="52" height="3" rx="1" fill="${MUTED}" opacity="0.25"/>`
);

/** Tooltip — hover info */
export const THUMB_TOOLTIP = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="24" y="14" width="72" height="28" rx="6" fill="${BORDER}" stroke="${MUTED}" stroke-width="0.5"/>` +
  `<text x="60" y="32" text-anchor="middle" font-size="8" fill="${FG}" font-family="sans-serif">Tooltip text</text>` +
  `<polygon points="54,42 60,50 66,42" fill="${BORDER}"/>` +
  `<circle cx="60" cy="62" r="4" fill="${ACCENT}" opacity="0.3"/>` +
  `<text x="60" y="65" text-anchor="middle" font-size="7" font-weight="700" fill="${ACCENT}" font-family="sans-serif">?</text>`
);

// ============================================================================
// Media (3)
// ============================================================================

/** Avatar — circular image */
export const THUMB_AVATAR = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<circle cx="60" cy="36" r="20" fill="${ACCENT}" opacity="0.2"/>` +
  `<circle cx="60" cy="30" r="8" fill="${ACCENT}" opacity="0.4"/>` +
  `<ellipse cx="60" cy="50" rx="14" ry="8" fill="${ACCENT}" opacity="0.3"/>` +
  `<text x="60" y="70" text-anchor="middle" font-size="7" fill="${MUTED}" font-family="sans-serif">Avatar</text>`
);

/** Video — play button */
export const THUMB_VIDEO = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="14" y="10" width="92" height="60" rx="4" fill="${BORDER}"/>` +
  `<circle cx="60" cy="40" r="14" fill="#000" opacity="0.5"/>` +
  `<polygon points="54,32 54,48 68,40" fill="#fff" opacity="0.9"/>`
);

/** Carousel — sliding cards */
export const THUMB_CAROUSEL = svg(
  `<rect width="120" height="80" rx="4" fill="${BG}"/>` +
  `<rect x="4" y="14" width="24" height="44" rx="3" fill="${BORDER}" opacity="0.4"/>` +
  `<rect x="32" y="10" width="56" height="52" rx="4" fill="${ACCENT}" opacity="0.2" stroke="${ACCENT}" stroke-width="1" opacity="0.3"/>` +
  `<rect x="92" y="14" width="24" height="44" rx="3" fill="${BORDER}" opacity="0.4"/>` +
  `<text x="24" y="72" font-size="10" fill="${MUTED}" font-family="sans-serif">‹</text>` +
  `<circle cx="54" cy="70" r="2" fill="${ACCENT}"/>` +
  `<circle cx="62" cy="70" r="2" fill="${MUTED}"/>` +
  `<circle cx="70" cy="70" r="2" fill="${MUTED}"/>` +
  `<text x="96" y="72" font-size="10" fill="${MUTED}" font-family="sans-serif">›</text>`
);
