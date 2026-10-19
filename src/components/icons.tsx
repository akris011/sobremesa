// Line icons drawn for Sobremesa: thin strokes to sit beside serif type.
type P = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const BookIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5c-.8 0-1.5.5-1.5 1.2V5.5Z" />
    <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5.5 1.5 1.2V5.5Z" />
    <path d="M11 4c.6.5 1.4.5 2 0M11 19c.6.5 1.4.5 2 0" />
  </svg>
);

export const TableIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="12" cy="11" r="5" />
    <circle cx="12" cy="11" r="2.4" />
    <path d="M4 6v4.5c0 .8.7 1.5 1.5 1.5M5.5 6v4M5.5 12v6.5M19 6c-1.1 0-2 1.8-2 4s.9 2.5 2 2.5V18.5" />
  </svg>
);

export const PenIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M15.5 4.5 19.5 8.5 9 19H5v-4L15.5 4.5Z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const PersonIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5c1.2-3.2 3.9-5 7-5s5.8 1.8 7 5" />
  </svg>
);

export const PlusIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const BackIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </svg>
);

export const ChevronIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </svg>
);

export const CloseIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/** A small sprig, used as an ornament in empty states and headers. */
export const Sprig = ({ className }: P) => (
  <svg viewBox="0 0 48 24" className={className} {...base} strokeWidth={1.1}>
    <path d="M4 12h40" />
    <path d="M24 12c-3-4-7-5-10-4 2 3 6 4 10 4ZM24 12c3-4 7-5 10-4-2 3-6 4-10 4ZM24 12c-2.5 3.5-6 4.5-9 3.5 2-2.8 5.5-3.5 9-3.5ZM24 12c2.5 3.5 6 4.5 9 3.5-2-2.8-5.5-3.5-9-3.5Z" />
  </svg>
);
