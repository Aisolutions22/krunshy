import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "krunshy_menu_mode";

export type MenuMode = "day" | "night";

function modeFromClock(): MenuMode {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Cairo",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  return h >= 6 && h < 18 ? "day" : "night";
}

type Ctx = { mode: MenuMode; toggleMode: () => void; ready: boolean };

const MenuThemeContext = createContext<Ctx | null>(null);

export function MenuThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<MenuMode>("day");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setMode(stored === "day" || stored === "night" ? stored : modeFromClock());
    setReady(true);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next: MenuMode = prev === "day" ? "night" : "day";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(() => ({ mode, toggleMode, ready }), [mode, toggleMode, ready]);
  return <MenuThemeContext.Provider value={value}>{children}</MenuThemeContext.Provider>;
}

export function useMenuTheme() {
  const ctx = useContext(MenuThemeContext);
  if (!ctx) throw new Error("useMenuTheme must be used inside MenuThemeProvider");
  return ctx;
}

/** Wrapper for customer-facing pages: scoped tokens + animated aurora background. */
export function MenuSurface({ children }: { children: ReactNode }) {
  const { mode } = useMenuTheme();
  return (
    <div className="menu-surface relative min-h-screen" data-menu-mode={mode}>
      <div aria-hidden className="menu-aurora" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
