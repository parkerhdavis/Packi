import { create } from "zustand";
import type { ModuleName } from "@/types";

interface AppState {
	activeModule: ModuleName;
	sidebarOpen: boolean;
	historySidebarOpen: boolean;
	setActiveModule: (module: ModuleName) => void;
	setSidebarOpen: (open: boolean) => void;
	toggleSidebar: () => void;
	toggleHistorySidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
	activeModule: "channel-packer",
	sidebarOpen: true,
	historySidebarOpen: false,

	setActiveModule: (module) => {
		set({ activeModule: module });
	},

	setSidebarOpen: (open) => {
		set({ sidebarOpen: open });
	},

	toggleSidebar: () => {
		set((s) => ({ sidebarOpen: !s.sidebarOpen }));
	},

	toggleHistorySidebar: () => {
		set((s) => ({ historySidebarOpen: !s.historySidebarOpen }));
	},
}));
