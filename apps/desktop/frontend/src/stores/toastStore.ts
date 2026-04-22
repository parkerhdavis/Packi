import { create } from "zustand";
import type { Toast } from "@/types";

interface ToastState {
	toasts: Toast[];
	addToast: (message: string, type?: Toast["type"]) => void;
	removeToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],

	addToast: (message, type = "info") => {
		const id = String(++nextId);
		set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
		setTimeout(() => {
			set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
		}, 4000);
	},

	removeToast: (id) => {
		set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
	},
}));
