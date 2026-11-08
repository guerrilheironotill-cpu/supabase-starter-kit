import { create } from "zustand";

type WhatsAppDrawerState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

// Single shared state so the quote drawer is mounted once (in the site header)
// and can be opened from anywhere on the page.
export const useWhatsAppDrawerStore = create<WhatsAppDrawerState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
