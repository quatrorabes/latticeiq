import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

const PortalContext = createContext<HTMLElement | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  return (
    <PortalContext.Provider value={document.body}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  return useContext(PortalContext);
}
