"use client";
import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  ArrowUpRight,
  Search,
  Plus,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("input,button,select");
    first?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) closeRef.current();
      if (e.key === "Tab" && el) {
        const nodes = Array.from(
          el.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ),
        );
        if (!nodes.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [busy]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Empty({
  icon: Icon,
  title,
  description,
  action,
  label,
  small = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: () => void;
  label?: string;
  small?: boolean;
}) {
  return (
    <div className={`empty-state ${small ? "empty-small" : ""}`}>
      <div className="empty-art">
        <div className="empty-orbit" />
        <div className="empty-icon">
          <Icon size={small ? 24 : 29} strokeWidth={1.4} />
        </div>
        <span className="empty-dot one" />
        <span className="empty-dot two" />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button
          className="button button-secondary button-small"
          onClick={action}
        >
          <Plus size={15} />
          {label || "Commencer"}
          <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  );
}
export function SectionHeading({
  title,
  description,
  children,
  eyebrow,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>
          {title}
          <span className="title-dot">.</span>
        </h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-field">
      <Search size={17} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button
          className="plain-button"
          onClick={() => onChange("")}
          aria-label="Effacer la recherche"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Select({
  value,
  onChange,
  children,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="select-wrap">
      <select
        aria-label={label || "Filtrer"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown size={15} />
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  full = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  full?: boolean;
}) {
  return (
    <label className={`field ${full ? "field-full" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Skeleton() {
  return (
    <div className="loading-line">
      <span />
    </div>
  );
}
export const statusTone = (status: string) =>
  status === "Terminée"
    ? "green"
    : status === "Annulée"
      ? "red"
      : status === "En préparation"
        ? "gold"
        : status === "Prête"
          ? "blue"
          : "muted";
