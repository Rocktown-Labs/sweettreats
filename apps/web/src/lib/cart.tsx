import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const CART_KEY = "sweet-treats-lr-cart";

export type CartMenuItem = {
  id: string;
  name: string;
  priceCents: number;
  imageKey?: string | null;
  available?: boolean;
  inventoryQuantity?: number;
  trackInventory?: boolean;
};

export type CartLine = CartMenuItem & {
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  /** False until the saved cart has been read from localStorage on the client. */
  ready: boolean;
  count: number;
  subtotalCents: number;
  addItem: (item: CartMenuItem, quantity?: number) => void;
  removeItem: (id: string) => void;
  increase: (id: string) => void;
  decrease: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function maxQuantity(item: CartMenuItem) {
  return item.trackInventory && typeof item.inventoryQuantity === "number"
    ? Math.max(0, item.inventoryQuantity)
    : 24;
}

function readInitialCart() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hasLoaded, setLoaded] = useState(false);

  useEffect(() => {
    setLines(readInitialCart());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  }, [hasLoaded, lines]);

  const addItem = useCallback((item: CartMenuItem, quantity = 1) => {
    setLines((current) => {
      const max = maxQuantity(item);
      if (max <= 0) {
        return current;
      }

      const existing = current.find((line) => line.id === item.id);
      if (existing) {
        return current.map((line) =>
          line.id === item.id
            ? { ...line, ...item, quantity: Math.min(max, line.quantity + quantity) }
            : line,
        );
      }

      return [...current, { ...item, quantity: Math.min(max, quantity) }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setLines((current) => current.filter((line) => line.id !== id));
  }, []);

  const increase = useCallback((id: string) => {
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? { ...line, quantity: Math.min(maxQuantity(line), line.quantity + 1) }
          : line,
      ),
    );
  }, []);

  const decrease = useCallback((id: string) => {
    setLines((current) =>
      current
        .map((line) => (line.id === id ? { ...line, quantity: line.quantity - 1 } : line))
        .filter((line) => line.quantity > 0),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotalCents = lines.reduce((sum, line) => sum + line.quantity * line.priceCents, 0);

    return {
      lines,
      ready: hasLoaded,
      count,
      subtotalCents,
      addItem,
      removeItem,
      increase,
      decrease,
      clear,
    };
  }, [addItem, clear, decrease, hasLoaded, increase, lines, removeItem]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) {
    throw new Error("useCart must be used within CartProvider");
  }

  return cart;
}
