/**
 * The glyphs `Icon` draws, keyed by name. Kept apart from the component so
 * the component file exports only a component.
 *
 * Adding a glyph: draw it on the 24-unit grid in the outline style the rest
 * use and add it below. An entry is either a list of path strings or, where a
 * shape reads better as primitives, a fragment of SVG elements.
 */

export const PATHS = {
  dashboard: ["M3 3h7v9H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 16h7v5H3z"],
  building: ["M6 22V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v18", "M3 22h18", "M10 7h1", "M13 7h1", "M10 11h1", "M13 11h1", "M10 15h1", "M13 15h1", "M10 22v-3h4v3"],
  card: ["M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z", "M2 10h20", "M6 15h4"],
  receipt: ["M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z", "M9 8h6", "M9 12h6", "M9 16h3"],
  ticket: ["M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z", "M9 15l6-6", "M9.5 9.5h.01", "M14.5 14.5h.01"],
  tag: ["M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z", "M7.5 7.5h.01"],
  puzzle: ["M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3h7z"],
  chart: ["M3 3v18h18", "M7 15l4-4 3 3 6-7"],
  bars: ["M3 21h18", "M6 17V9", "M11 17V5", "M16 17v-6", "M21 17v-3"],
  pie: ["M21 12A9 9 0 1 1 12 3v9z", "M15 3.5A9 9 0 0 1 20.5 9H15z"],
  gauge: ["M12 14l4-4", "M3.5 18a9 9 0 1 1 17 0"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M9 12l2 2 4-4"],
  boxes: ["M3 7l5-3 5 3v5l-5 3-5-3z", "M11 15l5-3 5 3v5l-5 3-5-3z", "M8 10v5", "M16 18v5"],
  template: ["M3 4h18v6H3z", "M3 14h8v6H3z", "M15 14h6v6h-6z"],
  layers: ["M12 2l10 5-10 5L2 7z", "M2 12l10 5 10-5", "M2 17l10 5 10-5"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
  key: ["M15 7a4 4 0 1 1-3.5 6L4 20.5V22H2v-3l7.5-7.5A4 4 0 0 1 15 7z", "M16 8h.01"],
  scroll: ["M8 21h11a2 2 0 0 0 2-2v-1H10v1a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h11a2 2 0 0 1 2 2v13", "M10 8h5", "M10 12h5"],
  monitor: ["M3 4h18v12H3z", "M8 20h8", "M12 16v4"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"],
  wrench: ["M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-4-4 2.3-2.3a4 4 0 0 0-5-5L2 6l4-4z"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  sparkles: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z", "M19 3v4", "M21 5h-4", "M5 17v4", "M7 19H3"],
  trendUp: ["M22 7l-8.5 8.5-5-5L2 17", "M16 7h6v6"],
  trendDown: ["M22 17l-8.5-8.5-5 5L2 7", "M16 17h6v-6"],
  alert: ["M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"],
  check: ["M22 11.1V12a10 10 0 1 1-5.9-9.1", "M22 4L12 14l-3-3"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
  calendar: ["M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M16 2v4", "M8 2v4", "M3 10h18"],
  wallet: ["M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v4", "M3 5v14a2 2 0 0 0 2 2h15v-4", "M18 12a2 2 0 0 0 0 4h4v-4z"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M8 13h8", "M8 17h5"],
  send: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4z"],
  ban: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M4.9 4.9l14.2 14.2"],
  archive: ["M3 3h18v5H3z", "M5 8v13h14V8", "M10 12h4"],
  plus: ["M12 5v14", "M5 12h14"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"],
  x: ["M18 6L6 18", "M6 6l12 12"],
  chevronLeft: ["M15 18l-6-6 6-6"],
  chevronRight: ["M9 18l6-6-6-6"],
  chevronDown: ["M6 9l6 6 6-6"],
  arrowUp: ["M7 17L17 7", "M7 7h10v10"],
  arrowDown: ["M7 7l10 10", "M17 7v10H7"],
  refresh: ["M21 12a9 9 0 0 1-15 6.7L3 16", "M3 12a9 9 0 0 1 15-6.7L21 8", "M21 3v5h-5", "M3 21v-5h5"],
  copy: ["M9 9h11v11H9z", "M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"],
  history: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 7v5l4 2"],
  undo: ["M9 14L4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
  filter: ["M22 3H2l8 9.5V19l4 2v-8.5z"],
  mail: ["M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z", "M22 6l-10 7L2 6"],
  percent: ["M19 5L5 19", "M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", "M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  coins: ["M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12z", "M18.1 10.4A6 6 0 1 1 10.3 18", "M7 6h1v4", "M16.7 13.9l.7.7-2.8 2.8"],
  zap: ["M13 2L3 14h9l-1 8 10-12h-9z"],
  drive: ["M22 12H2", "M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z", "M6 16h.01", "M10 16h.01"],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.9 1.9 0 0 0 3.4 0"],
  database: ["M12 8c5 0 9-1.3 9-3s-4-3-9-3-9 1.3-9 3 4 3 9 3z", "M21 12c0 1.7-4 3-9 3s-9-1.3-9-3", "M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"],
  plug: ["M12 22v-5", "M9 8V2", "M15 8V2", "M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"],
  trash: ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6"],
  info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 16v-4", "M12 8h.01"],
  rocket: ["M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z", "M12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z", "M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0", "M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"],
  globe: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  lock: ["M5 11h14v11H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  play: ["M6 3l14 9-14 9z"],
  pause: ["M6 4h4v16H6z", "M14 4h4v16h-4z"],
  star: ["M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"],
  heart: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"],

  // Shell and layout.
  home: ["M3 10.5L12 3l9 7.5", "M5 9v12h14V9", "M10 21v-6h4v6"],
  briefcase: ["M3 7h18v13H3z", "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M3 13h18"],
  mapPin: ["M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  panelLeftClose: ["M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 3v18", "M16 9l-3 3 3 3"],
  panelLeftOpen: ["M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 3v18", "M14 9l3 3-3 3"],
  searchX: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3", "M8.5 8.5l5 5", "M13.5 8.5l-5 5"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],

  // Levels: the circled marks notifications use.
  checkCircle: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M9 12l2 2 4-4"],
  xCircle: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M15 9l-6 6", "M9 9l6 6"],

  // Navigation destinations, drawn for the rail's 1.75 stroke.
  // Four panes: the overview of everything.
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),

  // A rule with graduations.
  units: (
    <>
      <rect x="2.5" y="7" width="19" height="10" rx="2" />
      <path d="M7 7v3M11 7v4.5M15 7v3M19 7v4.5" />
    </>
  ),

  // Two coins.
  currencies: (
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M14.2 6.3A5.5 5.5 0 1 1 10.3 19" />
    </>
  ),

  // A globe.
  countries: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" />
    </>
  ),

  // Two people.
  customers: (
    <>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 20a6 6 0 0 1 12 0" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.6A6 6 0 0 1 21 20" />
    </>
  ),

  // A contact record.
  crm: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <circle cx="8.5" cy="11" r="2.5" />
      <path d="M4.8 16.5a4 4 0 0 1 7.4 0M14.5 9.5h4.5M14.5 13h3" />
    </>
  ),

  // A rising line: what the business is doing.
  sales: (
    <>
      <path d="M3 16.5 9 10l4 4 7.5-7.5" />
      <path d="M15 6.5h5.5V12" />
    </>
  ),

  // A shopping bag.
  purchase: (
    <>
      <path d="M4.5 7.5h15l-1.2 12a2 2 0 0 1-2 1.8H7.7a2 2 0 0 1-2-1.8Z" />
      <path d="M8.75 7.5a3.25 3.25 0 0 1 6.5 0" />
    </>
  ),

  // A carton.
  inventory: (
    <>
      <path d="M3.5 7.8 12 3.5l8.5 4.3v8.4L12 20.5l-8.5-4.3Z" />
      <path d="M3.5 7.8 12 12.1l8.5-4.3M12 12.1v8.4" />
    </>
  ),

  // A banknote.
  finance: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.75" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),

  // An identity badge.
  hrms: (
    <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M9 4.5V3h6v1.5" />
      <circle cx="12" cy="11" r="2.5" />
      <path d="M8.3 17.3a4 4 0 0 1 7.4 0" />
    </>
  ),

  // A checklist.
  projects: (
    <>
      <rect x="4.5" y="4" width="15" height="17" rx="2.5" />
      <path d="M9 3h6v2.5H9z" />
      <path d="M8.75 11.5l1.75 1.75 3.5-3.5M8.75 16.5h6.5" />
    </>
  ),

  // Bars.
  reports: (
    <>
      <path d="M3.5 20.5h17" />
      <rect x="5.5" y="12" width="3.5" height="6" rx="1" />
      <rect x="10.25" y="7.5" width="3.5" height="10.5" rx="1" />
      <rect x="15" y="10" width="3.5" height="8" rx="1" />
    </>
  ),

  // Sliders: the things you set for everybody.
  administration: (
    <>
      <path d="M4 7.5h7M15.5 7.5H20M4 16.5h4.5M13 16.5H20" />
      <circle cx="13.25" cy="7.5" r="2.25" />
      <circle cx="10.75" cy="16.5" r="2.25" />
    </>
  ),

  // A swatch: half the disc filled, which is the conventional mark for a
  // light/dark choice. The fill is set on the path because the sheet draws
  // everything else stroke-only -- unfilled, this reads as a clock.
  appearance: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </>
  ),

  // A number series.
  numbering: (
    <>
      <path d="M9.5 3.5 7.5 20.5M16.5 3.5l-2 17M4 8.5h16M3 15.5h16" />
    </>
  ),
};

/** Every glyph name, for tests and for anyone choosing one. */
export const ICON_NAMES = Object.keys(PATHS);
