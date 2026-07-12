import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FormDebugLevel = "info" | "success" | "error";

export type FormDebugLog = {
  id: string;
  createdAt: string;
  level: FormDebugLevel;
  action: string;
  message: string;
  details?: unknown;
};

type FormDebugLogState = {
  logs: FormDebugLog[];
  addLog: (log: Omit<FormDebugLog, "id" | "createdAt">) => void;
  clearLogs: () => void;
};

export const useFormDebugLogStore = create<FormDebugLogState>()(
  persist(
    (set) => ({
      logs: [],
      addLog: (log) => {
        const full: FormDebugLog = {
          ...log,
          id: `form_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ logs: [full, ...state.logs].slice(0, 80) }));
      },
      clearLogs: () => set({ logs: [] }),
    }),
    { name: "whatsapp-form-debug" },
  ),
);

export function compactError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const err = error as Record<string, unknown>;
  return {
    message: typeof err.message === "string" ? err.message : String(error),
    code: err.code,
    details: err.details,
    hint: err.hint,
    status: err.status,
    name: err.name,
  };
}