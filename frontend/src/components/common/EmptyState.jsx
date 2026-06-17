import { Link } from "react-router-dom";

const ILLUSTRATIONS = {
  trips: (
    <svg viewBox="0 0 120 80" width="120" height="80" fill="none" aria-hidden="true">
      <rect x="10" y="40" width="100" height="30" rx="6" fill="var(--color-primary-light)" />
      <circle cx="30" cy="70" r="8" fill="var(--color-border)" />
      <circle cx="90" cy="70" r="8" fill="var(--color-border)" />
      <path d="M10 40 Q60 10 110 40" stroke="var(--color-primary)" strokeWidth="2.5" strokeDasharray="6 4" fill="none" />
      <circle cx="10" cy="40" r="5" fill="var(--color-primary)" />
      <circle cx="110" cy="40" r="5" fill="var(--color-accent)" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 120 80" width="120" height="80" fill="none" aria-hidden="true">
      <circle cx="52" cy="38" r="26" stroke="var(--color-primary)" strokeWidth="3" fill="var(--color-primary-light)" />
      <line x1="70" y1="56" x2="90" y2="76" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="38" x2="64" y2="38" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="26" x2="52" y2="50" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 120 80" width="120" height="80" fill="none" aria-hidden="true">
      <rect x="10" y="10" width="70" height="45" rx="10" fill="var(--color-primary-light)" stroke="var(--color-primary)" strokeWidth="2" />
      <rect x="40" y="30" width="70" height="40" rx="10" fill="var(--color-border)" />
      <line x1="22" y1="25" x2="58" y2="25" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
      <line x1="22" y1="35" x2="50" y2="35" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  bookings: (
    <svg viewBox="0 0 120 80" width="120" height="80" fill="none" aria-hidden="true">
      <rect x="20" y="10" width="80" height="60" rx="8" fill="var(--color-primary-light)" stroke="var(--color-primary)" strokeWidth="2" />
      <line x1="35" y1="30" x2="85" y2="30" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
      <line x1="35" y1="42" x2="75" y2="42" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
      <line x1="35" y1="54" x2="60" y2="54" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="10" r="6" fill="var(--color-accent)" />
      <path d="M17 10l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  notifications: (
    <svg viewBox="0 0 120 80" width="120" height="80" fill="none" aria-hidden="true">
      <path d="M60 15a25 25 0 0 1 25 25v12l8 8H27l8-8V40A25 25 0 0 1 60 15z" fill="var(--color-primary-light)" stroke="var(--color-primary)" strokeWidth="2" />
      <path d="M55 68a5 5 0 0 0 10 0" stroke="var(--color-primary)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <line x1="60" y1="6" x2="60" y2="15" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 120 80" width="120" height="80" fill="none" aria-hidden="true">
      <circle cx="60" cy="40" r="30" fill="var(--color-primary-light)" stroke="var(--color-primary)" strokeWidth="2" />
      <line x1="60" y1="26" x2="60" y2="44" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="52" r="2.5" fill="var(--color-primary)" />
    </svg>
  ),
};

export default function EmptyState({ variant = "default", title, description, actionLabel, actionTo, onAction }) {
  return (
    <div className="empty-state empty-state--illustrated">
      <div className="empty-state__illustration">{ILLUSTRATIONS[variant] ?? ILLUSTRATIONS.default}</div>
      {title && <p className="empty-state__title">{title}</p>}
      {description && <p className="empty-state__desc">{description}</p>}
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn btn-primary btn-sm">
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary btn-sm" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
