"use client";

import { useCallback, useRef } from "react";

/**
 * Create a debounced version of a callback
 * @param callback - Function to debounce
 * @param delay - Delay in milliseconds
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);

  return useCallback(
    ((...args: Parameters<T>) => {
      // Prevent multiple simultaneous executions
      if (isExecutingRef.current) {
        return;
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(async () => {
        isExecutingRef.current = true;
        try {
          await callback(...args);
        } finally {
          isExecutingRef.current = false;
        }
      }, delay);
    }) as T,
    [callback, delay]
  );
}