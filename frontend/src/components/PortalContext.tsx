import { createContext, useContext, ReactNode } from 'react';

const PortalContext = createContext<HTMLDivElement | null>(null);

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
