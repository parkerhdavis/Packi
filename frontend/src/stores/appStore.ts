import { create } from "zustand";
import type { ModuleName } from "@/types";

interface AppState {
	activeModule: ModuleName;
	sidebarOpen: boolean;
	setActiveModule: (module: ModuleName) => void;
	setSidebarOpen: (open: boolean) => void;
	toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
	activeModule: "channel-packer",
	sidebarOpen: true,

	setActiveModule: (module) => {
		set({ activeModule: module });
	},

	setSidebarOpen: (open) => {
		set({ sidebarOpen: open });
	},

	toggleSidebar: () => {
		set((s) => ({ sidebarOpen: !s.sidebarOpen }));
	},
}));
