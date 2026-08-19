import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  query: string;
  setQuery: (v: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
};

const MenuSearchContext = createContext<Ctx | null>(null);

/** Shared search state so the header utility can drive the menu page results. */
export function MenuSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const value = useMemo<Ctx>(() => ({ query, setQuery, open, setOpen }), [query, open]);
  return <MenuSearchContext.Provider value={value}>{children}</MenuSearchContext.Provider>;
}

export function useMenuSearch() {
  const ctx = useContext(MenuSearchContext);
  if (!ctx) throw new Error("useMenuSearch must be used inside MenuSearchProvider");
  return ctx;
}
