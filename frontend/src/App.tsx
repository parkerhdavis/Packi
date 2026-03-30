import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAppStore } from "@/stores/appStore";
import Sidebar from "@/components/Sidebar";
import PackTools from "@/components/PackTools";
import AdjustTools from "@/components/AdjustTools";
import BatchProcessor from "@/components/BatchProcessor";
import TilingTools from "@/components/TilingTools";
import FileSizing from "@/components/FileSizing";
import AppSettings from "@/components/AppSettings";
import StatusBar from "@/components/ui/StatusBar";
import ToastContainer from "@/components/ui/ToastContainer";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

export default function App() {
	const { loaded, load, zoomIn, zoomOut, zoomReset } = useSettingsStore();
	const zoom = useSettingsStore((s) => s.settings.zoom) ?? 100;
	const activeModule = useAppStore((s) => s.activeModule);
	const toggleSidebar = useAppStore((s) => s.toggleSidebar);
	const [splashDone, setSplashDone] = useState(false);
	const [fadeOut, setFadeOut] = useState(false);

	useEffect(() => {
		load();
	}, [load]);

	// Save active module to settings for restoring on next launch
	useEffect(() => {
		if (!loaded || activeModule === "settings") return;
		useSettingsStore.getState().save({ last_module: activeModule });
	}, [activeModule, loaded]);

	// Restore last module and sidebar state on load
	useEffect(() => {
		if (!loaded) return;
		const settings = useSettingsStore.getState().settings;
		if (settings.last_module && settings.last_module !== "settings") {
			useAppStore.getState().setActiveModule(settings.last_module as typeof activeModule);
		}
		if (settings.sidebar_open !== null) {
			useAppStore.getState().setSidebarOpen(settings.sidebar_open);
		}
	}, [loaded]);

	// Persist sidebar state changes to settings
	const sidebarOpen = useAppStore((s) => s.sidebarOpen);
	useEffect(() => {
		if (!loaded) return;
		useSettingsStore.getState().save({ sidebar_open: sidebarOpen });
	}, [sidebarOpen, loaded]);

	// Global zoom keyboard shortcuts: Ctrl+= / Ctrl+- / Ctrl+0
	useEffect(() => {
		const handleZoom = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			if (e.key === "=" || e.key === "+") {
				e.preventDefault();
				zoomIn();
			} else if (e.key === "-") {
				e.preventDefault();
				zoomOut();
			} else if (e.key === "0") {
				e.preventDefault();
				zoomReset();
			}
		};
		window.addEventListener("keydown", handleZoom);
		return () => window.removeEventListener("keydown", handleZoom);
	}, [zoomIn, zoomOut, zoomReset]);

	// Global module switching: Ctrl+1/2/3, sidebar toggle: Ctrl+/, history: Ctrl+\
	useEffect(() => {
		const handleKeys = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			const setModule = useAppStore.getState().setActiveModule;
			if (e.key === "1") { e.preventDefault(); setModule("adjust"); }
			else if (e.key === "2") { e.preventDefault(); setModule("pack"); }
			else if (e.key === "3") { e.preventDefault(); setModule("tiling"); }
			else if (e.key === "4") { e.preventDefault(); setModule("file-sizing"); }
			else if (e.key === "5") { e.preventDefault(); setModule("batch-processor"); }
			else if (e.key === "/") { e.preventDefault(); toggleSidebar(); }
			else if (e.key === "\\") { e.preventDefault(); useAppStore.getState().toggleHistorySidebar(); }
		};
		window.addEventListener("keydown", handleKeys);
		return () => window.removeEventListener("keydown", handleKeys);
	}, [toggleSidebar]);

	// Global undo/redo: Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z
	useEffect(() => {
		const handleUndoRedo = async (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			// Don't intercept when focused in text inputs (let browser handle native undo)
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;

			const { useUndoStore } = await import("@/stores/undoStore");
			if (e.key === "z" && !e.shiftKey) {
				e.preventDefault();
				useUndoStore.getState().undo();
			} else if (e.key === "z" && e.shiftKey) {
				e.preventDefault();
				useUndoStore.getState().redo();
			} else if (e.key === "y") {
				e.preventDefault();
				useUndoStore.getState().redo();
			}
		};
		window.addEventListener("keydown", handleUndoRedo);
		return () => window.removeEventListener("keydown", handleUndoRedo);
	}, []);

	// Splash: wait for settings to load, fade in icon+text, linger, then fade out
	useEffect(() => {
		if (!loaded) return;
		const fadeTimer = setTimeout(() => setFadeOut(true), 2600);
		const doneTimer = setTimeout(() => setSplashDone(true), 3000);
		return () => {
			clearTimeout(fadeTimer);
			clearTimeout(doneTimer);
		};
	}, [loaded]);

	const theme = useSettingsStore((s) => s.settings.theme);
	const splashIcon = theme === "light" ? "/packi-splash-light.png" : "/packi-splash-dark.png";

	if (!splashDone) {
		return (
			<div
				className={`flex flex-col items-center justify-center min-h-screen gap-6 transition-opacity duration-400 ${fadeOut ? "opacity-0" : "opacity-100"}`}
			>
				<img
					src={splashIcon}
					alt="Packi"
					className="size-40 animate-splash-icon"
				/>
				<span className="text-4xl font-bold tracking-tight animate-fade-in-up">
					Packi
				</span>
			</div>
		);
	}

	const page = (() => {
		switch (activeModule) {
			case "pack":
				return <PackTools />;
			case "adjust":
				return <AdjustTools />;
			case "tiling":
				return <TilingTools />;
			case "file-sizing":
				return <FileSizing />;
			case "batch-processor":
				return <BatchProcessor />;
			case "settings":
				return <AppSettings />;
		}
	})();

	return (
		<div className="flex flex-col h-screen">
			<div className="flex flex-1 min-h-0">
				<Sidebar />
				<div
					className="flex-1 min-w-0"
					style={zoom !== 100 ? { zoom: `${zoom}%` } : undefined}
				>
					<ErrorBoundary>{page}</ErrorBoundary>
				</div>
			</div>
			<StatusBar />
			<ToastContainer />
		</div>
	);
}
