"use client";

import Link from "next/link";
import { useState } from "react";

const PANEL_CLASS =
  "bg-background/55 backdrop-blur-md border border-border rounded-md text-foreground";

/**
 * Back button overlaid on a fullscreen lab. Always top-left. The lab content
 * underneath should be `position: fixed inset-0` (or the page's full-viewport
 * container) so this sits above it.
 */
export function BackButton() {
  return (
    <Link
      href="/lab"
      className={`${PANEL_CLASS} absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-2 text-sm font-mono no-underline hover:bg-background/75 transition-colors`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path
          d="M9 2 L3 7 L9 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>back</span>
    </Link>
  );
}

type FloatingPanelProps = {
  /** Where the panel attaches. Currently only the right edge is implemented. */
  side?: "right";
  /** Header label shown next to the collapse chevron. */
  title?: string;
  /** Default open or collapsed. */
  defaultOpen?: boolean;
  /** Vertical position from the top (px). Stack multiple panels by varying this. */
  top?: number;
  /** Panel width when open. */
  width?: number;
  children: React.ReactNode;
};

/**
 * Transparent collapsible panel that sits over a fullscreen lab canvas. The
 * collapse chevron lives flush against the panel edge so it stays reachable
 * when collapsed.
 */
export function FloatingPanel({
  title,
  defaultOpen = true,
  top = 16,
  width = 280,
  children,
}: FloatingPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="absolute right-4 z-20 flex items-start"
      style={{ top }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Collapse panel" : "Expand panel"}
        className={`${PANEL_CLASS} rounded-r-none border-r-0 px-1.5 py-2 hover:bg-background/75 transition-colors`}
        style={{ marginTop: 4 }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d={open ? "M4 2 L8 6 L4 10" : "M8 2 L4 6 L8 10"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className={`${PANEL_CLASS} rounded-tl-none overflow-hidden transition-[width,opacity] duration-200 ease-out ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ width: open ? width : 0 }}
      >
        <div className="p-4 space-y-4" style={{ width }}>
          {title && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              {title}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Stack multiple FloatingPanels with a fixed vertical rhythm. */
export const PANEL_ROW_SPACING = 78;
