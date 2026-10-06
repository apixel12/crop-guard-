// Small stroke icons drawn for this app (24px grid, currentColor).
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const Leaf = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <path d="M6 26C6 13 14 6 27 5c0 13-7 21-20 21z" fill="var(--accent)" />
    <path d="M7 25C12 19 17 14 23 10" stroke="var(--hull)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </svg>
)
export const ArrowLeft = () => <svg {...base}><path d="M15 18l-6-6 6-6" /></svg>
export const ArrowRight = () => <svg {...base} className="arrow"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
export const Gallery = () => <svg {...base} width={22} height={22}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
export const Retake = () => <svg {...base}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
export const Lock = () => <svg {...base} width={16} height={16}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
export const Trash = () => <svg {...base} width={18} height={18}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
