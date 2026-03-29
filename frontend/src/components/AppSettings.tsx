import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/settingsStore";
import { useChannelPackerStore } from "@/stores/channelPackerStore";
import PageHeader from "@/components/ui/PageHeader";
import { LuFolderOpen, LuPlus, LuTrash2 } from "react-icons/lu";

interface PresetLabels {
	r: string;
	g: string;
	b: string;
	a: string;
	r_invert: boolean;
	g_invert: boolean;
	b_invert: boolean;
	a_invert: boolean;
}

interface PackingPreset {
	name: string;
	description: string;
	builtin: boolean;
	labels: PresetLabels;
}

const emptyForm = {
	name: "",
	description: "",
	r: "",
	g: "",
	b: "",
	a: "",
	r_invert: false,
	g_invert: false,
	b_invert: false,
	a_invert: false,
};

export default function AppSettings() {
	const { settings, save, toggleTheme, zoomIn, zoomOut, zoomReset } = useSettingsStore();
	const zoom = settings.zoom ?? 100;
	const refreshPackerPresets = useChannelPackerStore((s) => s.loadPresets);

	const [builtinPresets, setBuiltinPresets] = useState<PackingPreset[]>([]);
	const [userPresets, setUserPresets] = useState<PackingPreset[]>([]);
	const [showForm, setShowForm] = useState(false);
	const [form, setForm] = useState(emptyForm);

	const loadAllPresets = useCallback(async () => {
		try {
			const builtin = await invoke<PackingPreset[]>("get_builtin_presets");
			const user = await invoke<PackingPreset[]>("load_user_presets");
			setBuiltinPresets(builtin);
			setUserPresets(user);
		} catch (err) {
			console.error("Failed to load presets:", err);
		}
	}, []);

	useEffect(() => {
		loadAllPresets();
	}, [loadAllPresets]);

	const handleSavePreset = useCallback(async () => {
		if (!form.name.trim()) return;
		const preset: PackingPreset = {
			name: form.name.trim(),
			description: form.description.trim(),
			builtin: false,
			labels: {
				r: form.r.trim(),
				g: form.g.trim(),
				b: form.b.trim(),
				a: form.a.trim(),
				r_invert: form.r_invert,
				g_invert: form.g_invert,
				b_invert: form.b_invert,
				a_invert: form.a_invert,
			},
		};
		try {
			await invoke("save_user_preset", { preset });
			setForm(emptyForm);
			setShowForm(false);
			await loadAllPresets();
			await refreshPackerPresets();
		} catch (err) {
			console.error("Failed to save preset:", err);
		}
	}, [form, loadAllPresets, refreshPackerPresets]);

	const handleDeletePreset = useCallback(async (name: string) => {
		try {
			await invoke("delete_user_preset", { name });
			await loadAllPresets();
			await refreshPackerPresets();
		} catch (err) {
			console.error("Failed to delete preset:", err);
		}
	}, [loadAllPresets, refreshPackerPresets]);

	const handlePickExportDir = useCallback(async () => {
		const result = await open({ directory: true });
		if (result) {
			await save({ last_export_dir: result as string });
		}
	}, [save]);

	const channelSlots = [
		{ key: "r" as const, label: "R", invertKey: "r_invert" as const },
		{ key: "g" as const, label: "G", invertKey: "g_invert" as const },
		{ key: "b" as const, label: "B", invertKey: "b_invert" as const },
		{ key: "a" as const, label: "A", invertKey: "a_invert" as const },
	];

	return (
		<div className="flex flex-col h-full">
			<PageHeader title="Settings" />

			<div className="flex-1 overflow-y-auto p-6">
				<div className="max-w-lg space-y-8">
					{/* Theme */}
					<section>
						<h2 className="text-sm font-semibold mb-3">Appearance</h2>
						<div className="flex gap-3">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="theme"
									className="radio radio-primary radio-sm"
									checked={settings.theme !== "light"}
									onChange={() => { if (settings.theme === "light") toggleTheme(); }}
								/>
								<span className="text-sm">Dark</span>
							</label>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="theme"
									className="radio radio-primary radio-sm"
									checked={settings.theme === "light"}
									onChange={() => { if (settings.theme !== "light") toggleTheme(); }}
								/>
								<span className="text-sm">Light</span>
							</label>
						</div>
					</section>

					{/* Zoom */}
					<section>
						<h2 className="text-sm font-semibold mb-3">Zoom</h2>
						<div className="flex items-center gap-3">
							<button type="button" onClick={zoomOut} className="btn btn-sm btn-ghost">
								-
							</button>
							<span className="font-mono text-sm w-12 text-center">{zoom}%</span>
							<button type="button" onClick={zoomIn} className="btn btn-sm btn-ghost">
								+
							</button>
							<button type="button" onClick={zoomReset} className="btn btn-sm btn-ghost">
								Reset
							</button>
						</div>
						<p className="text-xs text-base-content/40 mt-1">
							Keyboard: Ctrl+= / Ctrl+- / Ctrl+0
						</p>
					</section>

					{/* Default export directory */}
					<section>
						<h2 className="text-sm font-semibold mb-3">Default Export Directory</h2>
						<div className="flex gap-2 items-center">
							<input
								type="text"
								value={settings.last_export_dir ?? ""}
								readOnly
								placeholder="No directory set"
								className="input input-sm input-bordered flex-1 font-mono text-xs"
							/>
							<button
								type="button"
								onClick={handlePickExportDir}
								className="btn btn-sm btn-ghost"
							>
								<LuFolderOpen size={16} />
							</button>
						</div>
					</section>

					{/* Channel Packing Presets */}
					<section>
						<h2 className="text-sm font-semibold mb-3">Channel Packing Presets</h2>

						{/* Built-in presets */}
						<div className="space-y-1.5 mb-4">
							<p className="text-xs text-base-content/50 font-medium uppercase tracking-wider">Built-in</p>
							{builtinPresets.map((p) => (
								<div key={p.name} className="flex items-baseline gap-2 text-sm">
									<span className="font-medium text-base-content/80">{p.name}</span>
									<span className="text-xs text-base-content/40">{p.description}</span>
								</div>
							))}
						</div>

						{/* User presets */}
						<div className="space-y-1.5 mb-3">
							<p className="text-xs text-base-content/50 font-medium uppercase tracking-wider">Custom</p>
							{userPresets.length === 0 && (
								<p className="text-xs text-base-content/30">No custom presets yet.</p>
							)}
							{userPresets.map((p) => (
								<div key={p.name} className="flex items-center gap-2 text-sm">
									<span className="font-medium text-base-content/80 flex-1">{p.name}</span>
									<span className="text-xs text-base-content/40 flex-1">{p.description}</span>
									<button
										type="button"
										onClick={() => handleDeletePreset(p.name)}
										className="btn btn-ghost btn-xs h-6 min-h-0 px-1 text-error/60 hover:text-error"
										title="Delete preset"
									>
										<LuTrash2 size={12} />
									</button>
								</div>
							))}
						</div>

						{/* Add preset form */}
						{showForm ? (
							<div className="rounded-lg border border-base-300 bg-base-200/50 p-3 space-y-2">
								<input
									type="text"
									value={form.name}
									onChange={(e) => setForm({ ...form, name: e.target.value })}
									placeholder="Preset name"
									className="input input-xs input-bordered w-full"
								/>
								<input
									type="text"
									value={form.description}
									onChange={(e) => setForm({ ...form, description: e.target.value })}
									placeholder="Brief description"
									className="input input-xs input-bordered w-full"
								/>
								<div className="grid grid-cols-4 gap-1.5">
									{channelSlots.map((ch) => (
										<div key={ch.key} className="flex flex-col gap-1">
											<label className="text-xs font-bold text-base-content/50">{ch.label}</label>
											<input
												type="text"
												value={form[ch.key]}
												onChange={(e) => setForm({ ...form, [ch.key]: e.target.value })}
												placeholder="Label"
												className="input input-xs input-bordered w-full"
											/>
											<label className="flex items-center gap-1 cursor-pointer">
												<input
													type="checkbox"
													checked={form[ch.invertKey]}
													onChange={(e) => setForm({ ...form, [ch.invertKey]: e.target.checked })}
													className="checkbox checkbox-xs checkbox-primary"
												/>
												<span className="text-xs text-base-content/40">Invert</span>
											</label>
										</div>
									))}
								</div>
								<div className="flex gap-2 pt-1">
									<button
										type="button"
										onClick={handleSavePreset}
										disabled={!form.name.trim()}
										className="btn btn-primary btn-xs"
									>
										Save
									</button>
									<button
										type="button"
										onClick={() => { setShowForm(false); setForm(emptyForm); }}
										className="btn btn-ghost btn-xs"
									>
										Cancel
									</button>
								</div>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setShowForm(true)}
								className="btn btn-ghost btn-xs gap-1"
							>
								<LuPlus size={12} />
								Add Custom Preset
							</button>
						)}
					</section>

					{/* About */}
					<section>
						<h2 className="text-sm font-semibold mb-3">About</h2>
						<div className="flex items-start gap-3">
							<img
								src={settings.theme === "light" ? "/packi-splash-light.png" : "/packi-splash-dark.png"}
								alt="Packi"
								className="size-10 shrink-0"
							/>
							<div className="text-sm text-base-content/60 space-y-1">
								<p><strong>Packi</strong> v0.1.0</p>
								<p>Texture packing and asset prep toolkit for game artists.</p>
								<p>
									Developed by{" "}
									<button
										type="button"
										onClick={() => openUrl("https://parkerhdavis.com")}
										className="text-primary hover:underline cursor-pointer"
									>
										Parker H. Davis
									</button>
								</p>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
