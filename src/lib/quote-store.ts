import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QuoteItem = {
  id: string;
  name: string;
  slug?: string;
  image?: string;
  quantity: number;
  sizeLabel?: string;
  dimensions?: string;
  finish?: string;
  color?: string;
  unitPrice?: number;
  basePrice?: number;
  availableFinishes?: Array<{ name: string; extraPrice: number }>;
  availableColors?: string[];
};

type QuoteState = {
  items: QuoteItem[];
  addItem: (item: Omit<QuoteItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateConfiguration: (
    id: string,
    configuration: Pick<QuoteItem, "finish" | "color" | "unitPrice">,
  ) => void;
  updateConfigurationOptions: (
    id: string,
    options: Pick<QuoteItem, "availableFinishes" | "availableColors" | "basePrice">,
  ) => void;
  clear: () => void;
  count: () => number;
};

export const useQuoteStore = create<QuoteState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, quantity: i.quantity + (item.quantity ?? 1) } : i,
              ),
            };
          }
          return {
            items: [...state.items, { ...item, quantity: item.quantity ?? 1 }],
          };
        }),
      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.id === id ? { ...i, quantity } : i))
            .filter((i) => i.quantity > 0),
        })),
      updateConfiguration: (id, configuration) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, ...configuration } : item)),
        })),
      updateConfigurationOptions: (id, options) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, ...options } : item)),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.quantity, 0),
    }),
    { name: "quote-cart" },
  ),
);
