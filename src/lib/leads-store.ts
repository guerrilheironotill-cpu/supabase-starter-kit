import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuoteItem } from "./quote-store";

export type Lead = {
  id: string;
  name: string;
  phone: string;
  createdAt: string; // ISO
  items: QuoteItem[];
  source: "whatsapp";
};

type LeadsState = {
  leads: Lead[];
  addLead: (lead: Omit<Lead, "id" | "createdAt">) => Lead;
  clear: () => void;
};

export const useLeadsStore = create<LeadsState>()(
  persist(
    (set) => ({
      leads: [],
      addLead: (lead) => {
        const full: Lead = {
          ...lead,
          id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ leads: [full, ...state.leads] }));
        return full;
      },
      clear: () => set({ leads: [] }),
    }),
    { name: "crm-leads" },
  ),
);
