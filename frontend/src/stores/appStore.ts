import { create } from "zustand";
import type { ModuleName } from "@/types";

interface AppState {
	activeModule: ModuleName;
	setActiveModule: (module: ModuleName) => void;
}

export const useAppStore = create<AppState>((set) => ({
	activeModule: "channel-packer",

	setActiveModule: (module) => {
		set({ activeModule: module });
	},
}));
