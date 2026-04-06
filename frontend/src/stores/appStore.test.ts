import { describe, test, expect, beforeEach } from "bun:test";
import { useAppStore } from "./appStore";

describe("appStore", () => {
	beforeEach(() => {
		useAppStore.setState({
			activeModule: "adjust",
			sidebarOpen: true,
			historySidebarOpen: false,
		});
	});

	test("initial state defaults", () => {
		const state = useAppStore.getState();
		expect(state.activeModule).toBe("adjust");
		expect(state.sidebarOpen).toBe(true);
		expect(state.historySidebarOpen).toBe(false);
	});

	test("setActiveModule changes module", () => {
		useAppStore.getState().setActiveModule("pack");
		expect(useAppStore.getState().activeModule).toBe("pack");
	});

	test("setActiveModule accepts all module names", () => {
		const modules = ["adjust", "pack", "preview", "size", "batch-processor", "settings"] as const;
		for (const mod of modules) {
			useAppStore.getState().setActiveModule(mod);
			expect(useAppStore.getState().activeModule).toBe(mod);
		}
	});

	test("toggleSidebar flips state", () => {
		expect(useAppStore.getState().sidebarOpen).toBe(true);
		useAppStore.getState().toggleSidebar();
		expect(useAppStore.getState().sidebarOpen).toBe(false);
		useAppStore.getState().toggleSidebar();
		expect(useAppStore.getState().sidebarOpen).toBe(true);
	});

	test("setSidebarOpen sets explicit value", () => {
		useAppStore.getState().setSidebarOpen(false);
		expect(useAppStore.getState().sidebarOpen).toBe(false);
		useAppStore.getState().setSidebarOpen(true);
		expect(useAppStore.getState().sidebarOpen).toBe(true);
	});

	test("toggleHistorySidebar flips state", () => {
		expect(useAppStore.getState().historySidebarOpen).toBe(false);
		useAppStore.getState().toggleHistorySidebar();
		expect(useAppStore.getState().historySidebarOpen).toBe(true);
		useAppStore.getState().toggleHistorySidebar();
		expect(useAppStore.getState().historySidebarOpen).toBe(false);
	});
});
