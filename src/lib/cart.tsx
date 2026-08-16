import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = {
  productId: string;
  nameAr: string;
  nameEn: string;
  price: number;
  quantity: number;
  image: string | null;
};

type Ctx = {
  lines: CartLine[];
  count: number;
  total: number;
  add: (line: Omit<CartLine, "quantity">) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = "krunshy_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      /* ignore corrupt cart */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    // Never write before the stored cart has been read, otherwise the initial
    // empty state (or a StrictMode remount) would wipe the saved cart.
    if (!loaded) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable */
    }
  }, [lines, loaded]);


  const add = useCallback((line: Omit<CartLine, "quantity">) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === line.productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === line.productId ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l,
        );
      }
      return [...prev, { ...line, quantity: 1 }];
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(99, qty) } : l)),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<Ctx>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      total: lines.reduce((s, l) => s + l.quantity * l.price, 0),
      add,
      setQty,
      remove,
      clear,
    }),
    [lines, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
