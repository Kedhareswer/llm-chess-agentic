"use client";

import { createContext, useContext, ReactNode } from "react";

interface SettingsContextType {
  openSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ 
  children, 
  openSettings 
}: { 
  children: ReactNode;
  openSettings: () => void;
}) {
  return (
    <SettingsContext.Provider value={{ openSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
