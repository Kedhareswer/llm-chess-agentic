"use client";

import { useState } from "react";
import { Header } from "./header";
import { NavDrawer } from "./nav-drawer";
import { SettingsModal } from "./settings-modal";
import { SettingsProvider } from "@/contexts/settings-context";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const openSettings = () => setIsSettingsOpen(true);

  return (
    <SettingsProvider openSettings={openSettings}>
      <div className="flex h-screen flex-col">
        <Header 
          onMenuClick={() => setIsDrawerOpen(true)} 
          onSettingsClick={openSettings}
        />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>

      {/* Navigation Drawer */}
      <NavDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpenSettings={openSettings}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </SettingsProvider>
  );
}
