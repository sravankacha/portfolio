"use client";

import { usePathname } from "next/navigation";

/**
 * Wrap site chrome (Header / Footer) so it disappears on /lab/<experiment>
 * routes. The /lab index itself keeps the chrome.
 */
export default function HideOnExperimentRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  if (path && /^\/lab\/[^/]+/.test(path)) return null;
  return <>{children}</>;
}
