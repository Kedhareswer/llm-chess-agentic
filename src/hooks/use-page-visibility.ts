"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when the tab is visible, false when hidden.
 * Use to pause or slow polling when user switches tabs.
 */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(
    typeof document !== "undefined" ? !document.hidden : true
  );

  useEffect(() => {
    const handleChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleChange);
    return () => document.removeEventListener("visibilitychange", handleChange);
  }, []);

  return visible;
}
