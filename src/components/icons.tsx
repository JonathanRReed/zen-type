import React from 'react';

// The handful of glyphs the interface uses, drawn on one 24px grid with one
// stroke weight so they sit quietly next to the serif.

type IconProps = React.SVGProps<SVGSVGElement>;

const Base: React.FC<IconProps> = ({ children, ...rest }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
);

/** The Zen Typer mark: four keycaps either side of a caret. */
export const Mark: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 32 26" width="26" height="21" aria-hidden="true" focusable="false" {...props}>
    <rect x="1" y="5" width="11" height="5" rx="1.6" fill="#7a7c9c" />
    <rect x="20" y="5" width="11" height="5" rx="1.6" fill="#a678e6" />
    <rect x="1" y="16" width="11" height="5" rx="1.6" fill="#e0527f" />
    <rect x="20" y="16" width="11" height="5" rx="1.6" fill="#f0b24d" />
    <rect x="15.1" y="1" width="1.8" height="24" rx="0.9" fill="currentColor" />
  </svg>
);

export const IconShuffle: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M3 7h3.2c1.7 0 3.2.9 4.1 2.3l3.4 5.4c.9 1.4 2.4 2.3 4.1 2.3H21" />
    <path d="M3 17h3.2c1.2 0 2.3-.4 3.2-1.2M21 7h-3.2c-1.2 0-2.3.4-3.2 1.2" />
    <path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5 21 17l-2.5 2.5" />
  </Base>
);

export const IconPen: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L5 17z" />
    <path d="m14.5 7.5 3 3" />
  </Base>
);

export const IconPage: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" />
    <path d="M9 12h6M9 16h4" />
  </Base>
);

export const IconSoundOn: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M11 5 6.5 9H3.5v6h3L11 19z" />
    <path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.8 7a7 7 0 0 1 0 10" />
  </Base>
);

export const IconSoundOff: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M11 5 6.5 9H3.5v6h3L11 19z" />
    <path d="m16 9.5 5 5m0-5-5 5" />
  </Base>
);

export const IconMenu: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M4 8h16M4 16h16" />
  </Base>
);

export const IconClose: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconBack: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Base>
);

export const IconCheck: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);

export const IconPlus: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconCopy: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="1.8" />
    <path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </Base>
);

export const IconDownload: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M12 4.5v10M7.5 10.5 12 15l4.5-4.5" />
    <path d="M5 19.5h14" />
  </Base>
);

export const IconHistory: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
    <path d="M4.5 4.5V9H9" />
    <path d="M12 8v4.2l2.8 1.8" />
  </Base>
);

export const IconSliders: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Base>
);

export const IconSearch: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
  </Base>
);

export const IconChevronUp: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="m6.5 14.5 5.5-5.5 5.5 5.5" />
  </Base>
);

export const IconChevronDown: React.FC<IconProps> = (props) => (
  <Base {...props}>
    <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
  </Base>
);
