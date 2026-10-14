'use client';

import { createContext, useContext, type ReactNode } from 'react';

const DashboardPanelVisibilityContext = createContext(true);

export function DashboardPanelVisibilityProvider({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <DashboardPanelVisibilityContext.Provider value={visible}>
      {children}
    </DashboardPanelVisibilityContext.Provider>
  );
}

export function useDashboardPanelVisibility(): boolean {
  return useContext(DashboardPanelVisibilityContext);
}