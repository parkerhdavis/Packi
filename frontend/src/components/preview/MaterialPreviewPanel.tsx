import { useRef, useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/settingsStore";
import DropZone from "@/components/ui/DropZone";
import { LuWand } from "react-icons/lu";
import type { ImageInfo } from "@/types";

type GeometryType = "plane" | "cube" | "sphere" | "cylinder" | "torus";
type NormalType = "opengl" | "directx";

const geometryOptions: { value: GeometryType; label: string }[] = [
	{ value: "plane", label: "Plane" },
	{ value: "cube", label: "Cube" },
	{ value: "sphere", label: "Sphere" },
	{ value: "cylinder", label: "Cylinder" },
	{ value: "torus", label: "Torus" },
];

const environmentOptions = [
	{ value: "studio", label: "Studio" },
	{ value: "dune", label: "Dune" },
	{ value: "forest", label: "Forest" },
	{ value: "field", label: "Field" },
	{ value: "lab", label: "Computer Lab" },
	{ value: "night", label: "Night" },
];

interface TextureSlot {
	path: string | null;
	preview: string | null;
	info: ImageInfo | null;
}

const emptySlot: TextureSlot = { path: null, preview: null, info: null };

const mapSlots = [
	{ key: "color", label: "Color (Albedo)", pbrKey: "color_url", keywords: ["color", "albedo", "basecolor", "base_color", "diffuse"] },
	{ key: "normal", label: "Normal Map", pbrKey: "normal_url", keywords: ["normal", "norm", "nrm"] },
	{ key: "roughness", label: "Roughness", pbrKey: "roughness_url", keywords: ["roughness", "rough"] },
	{ key: "metalness", label: "Metalness", pbrKey: "metalness_url", keywords: ["metalness", "metallic", "metal"] },
	{ key: "ambientocclusion", label: "Ambient Occlusion", pbrKey: "ambientocclusion_url", keywords: ["ambientocclusion", "ao", "occlusion"] },
	{ key: "displacement", label: "Displacement", pbrKey: "displacement_url", keywords: ["displacement", "disp", "height"] },
	{ key: "opacity", label: "Opacity", pbrKey: "opacity_url", keywords: ["opacity", "alpha", "transparency"] },
] as const;

type MapKey = typeof mapSlots[number]["key"];

export default function MaterialPreviewPanel() {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [iframeReady, setIframeReady] = useState(false);

	// Texture slots
	const [textures, setTextures] = useState<Record<MapKey, TextureSlot>>({
		color: { ...emptySlot },
		normal: { ...emptySlot },
		roughness: { ...emptySlot },
		metalness: { ...emptySlot },
		ambientocclusion: { ...emptySlot },
		displacement: { ...emptySlot },
		opacity: { ...emptySlot },
	});

	// Scene controls
	const [geometry, setGeometry] = useState<GeometryType>("sphere");
	const [normalType, setNormalType] = useState<NormalType>("opengl");
	const [normalScale, setNormalScale] = useState(1.0);
	const [displacementScale, setDisplacementScale] = useState(0.01);
	const [tilingScale, setTilingScale] = useState(1.0);
	const [clayRender, setClayRender] = useState(false);
	const [environment, setEnvironment] = useState("studio");

	// Loading states
	const [loadingSlot, setLoadingSlot] = useState<MapKey | null>(null);
	const [autofilling, setAutofilling] = useState(false);
	const inputDir = useSettingsStore((s) => s.settings.input_dir);

	// Listen for PBR.ONE ready message
	useEffect(() => {
		const handleMessage = (e: MessageEvent) => {
			if (e.data?.type === "packi-pbr-ready") {
				setIframeReady(true);
			}
		};
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, []);

	// Send config to PBR.ONE iframe
	const sendConfig = useCallback((config: Record<string, unknown>) => {
		const iframe = iframeRef.current;
		if (!iframe?.contentWindow) return;
		iframe.contentWindow.postMessage({ type: "packi-pbr-update", config }, "*");
	}, []);

	// Push initial config + environment when iframe is ready
	useEffect(() => {
		if (!iframeReady) return;
		const envUrl = `./media/env-${environment}-lq.exr`;
		sendConfig({
			geometry_type: geometry,
			normal_type: normalType,
			normal_scale: normalScale,
			displacement_scale: displacementScale,
			tiling_scale: tilingScale,
			clayrender_enable: clayRender ? 1 : 0,
			watermark_enable: 0,
			gui_enable: -1,
			fullscreen_enable: 0,
			environment_url: [envUrl],
			environment_name: [environment],
			environment_index: 0,
		});
	}, [iframeReady]);

	// Push control changes
	useEffect(() => {
		if (!iframeReady) return;
		sendConfig({ geometry_type: geometry });
	}, [geometry, iframeReady, sendConfig]);

	useEffect(() => {
		if (!iframeReady) return;
		sendConfig({ normal_type: normalType, normal_scale: normalScale });
	}, [normalType, normalScale, iframeReady, sendConfig]);

	useEffect(() => {
		if (!iframeReady) return;
		sendConfig({ displacement_scale: displacementScale });
	}, [displacementScale, iframeReady, sendConfig]);

	useEffect(() => {
		if (!iframeReady) return;
		sendConfig({ tiling_scale: tilingScale });
	}, [tilingScale, iframeReady, sendConfig]);

	useEffect(() => {
		if (!iframeReady) return;
		sendConfig({ clayrender_enable: clayRender ? 1 : 0 });
	}, [clayRender, iframeReady, sendConfig]);

	useEffect(() => {
		if (!iframeReady) return;
		const envUrl = `./media/env-${environment}-lq.exr`;
		sendConfig({
			environment_url: [envUrl],
			environment_name: [environment],
			environment_index: 0,
		});
	}, [environment, iframeReady, sendConfig]);

	// Load a texture into a slot and push it to PBR.ONE
	const loadTexture = useCallback(async (slot: MapKey, path: string) => {
		setLoadingSlot(slot);
		try {
			// Load thumbnail for the slot UI + full-res for the 3D preview
			const [info, thumbnail, fullRes] = await Promise.all([
				invoke<ImageInfo>("load_image_info", { path }),
				invoke<string>("load_image_as_base64", { path, maxPreviewSize: 128 }),
				invoke<string>("load_image_as_base64", { path, maxPreviewSize: 2048 }),
			]);

			setTextures((prev) => ({
				...prev,
				[slot]: { path, preview: thumbnail, info },
			}));

			// Pass as a data URL so the iframe can load it without cross-origin issues
			const dataUrl = `data:image/png;base64,${fullRes}`;
			const pbrKey = mapSlots.find((m) => m.key === slot)?.pbrKey;
			if (pbrKey) {
				sendConfig({ [pbrKey]: [dataUrl] });
			}
		} catch (err) {
			console.error(`Failed to load texture for ${slot}:`, err);
		}
		setLoadingSlot(null);
	}, [sendConfig]);

	// Clear a texture slot
	const clearTexture = useCallback((slot: MapKey) => {
		setTextures((prev) => ({
			...prev,
			[slot]: { ...emptySlot },
		}));
		const pbrKey = mapSlots.find((m) => m.key === slot)?.pbrKey;
		if (pbrKey) {
			sendConfig({ [pbrKey]: [] });
		}
	}, [sendConfig]);

	// Autofill: scan input directory for files matching each slot's keywords
	const handleAutofill = useCallback(async () => {
		if (!inputDir) return;
		setAutofilling(true);
		try {
			const files = await invoke<string[]>("list_image_files", { dir: inputDir });
			for (const slot of mapSlots) {
				// Skip slots that already have a texture
				if (textures[slot.key].path) continue;
				// Find first file whose name (case-insensitive) contains any keyword
				const match = files.find((filePath) => {
					const filename = filePath.split(/[/\\]/).pop()?.toLowerCase() ?? "";
					return slot.keywords.some((kw) => filename.includes(kw));
				});
				if (match) {
					await loadTexture(slot.key, match);
				}
			}
		} catch (err) {
			console.error("Autofill failed:", err);
		}
		setAutofilling(false);
	}, [inputDir, textures, loadTexture]);

	return (
		<div className="flex flex-1 min-w-0">
			{/* Controls */}
			<div className="w-72 shrink-0 flex flex-col border-r border-base-300 overflow-y-auto">
				{/* Header */}
				<div className="px-3 pt-3 pb-2 border-b border-base-300 shrink-0">
					<div className="text-sm font-semibold text-base-content">3D Material Preview</div>
					<div className="text-xs text-base-content/40 mt-0.5 leading-snug">
						Preview PBR materials on 3D geometry with image-based lighting. Powered by PBR.ONE.
					</div>
				</div>

				{/* Texture inputs */}
				<div className="p-3 space-y-2 border-b border-base-300">
					<div className="flex items-center justify-between">
						<label className="text-xs font-semibold text-base-content/50">
							Texture Maps
						</label>
						<button
							type="button"
							onClick={handleAutofill}
							disabled={!inputDir || autofilling}
							className="btn btn-ghost btn-xs h-6 min-h-0 px-2 gap-1"
							title={inputDir ? "Auto-detect textures from the input directory by filename" : "Set an input directory in the sidebar first"}
						>
							{autofilling ? (
								<span className="loading loading-spinner loading-xs" />
							) : (
								<LuWand size={12} />
							)}
							<span className="text-xs">Autofill</span>
						</button>
					</div>
					{mapSlots.map((slot) => (
						<div key={slot.key}>
							<label className="text-xs text-base-content/50 mb-0.5 block">
								{slot.label}
							</label>
							<DropZone
								label={`Drop ${slot.label.toLowerCase()}`}
								filePath={textures[slot.key].path}
								thumbnail={textures[slot.key].preview}
								onFilePicked={(path) => loadTexture(slot.key, path)}
								onClear={() => clearTexture(slot.key)}
								loading={loadingSlot === slot.key}
								compact
							/>
						</div>
					))}
				</div>

				{/* Scene controls */}
				<div className="p-3 space-y-3">
					<label className="text-xs font-semibold text-base-content/50 block">
						Scene
					</label>

					{/* Geometry */}
					<div title="3D shape to render the material on">
						<label className="text-xs text-base-content/50 mb-0.5 block">
							Geometry
						</label>
						<select
							value={geometry}
							onChange={(e) => setGeometry(e.target.value as GeometryType)}
							className="select select-xs select-bordered w-full"
						>
							{geometryOptions.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					{/* Environment */}
					<div title="HDR environment map for image-based lighting">
						<label className="text-xs text-base-content/50 mb-0.5 block">
							Environment
						</label>
						<select
							value={environment}
							onChange={(e) => setEnvironment(e.target.value)}
							className="select select-xs select-bordered w-full"
						>
							{environmentOptions.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					{/* Normal type */}
					<div title="Normal map convention: OpenGL (Y+) or DirectX (Y-)">
						<label className="text-xs text-base-content/50 mb-0.5 block">
							Normal Map Type
						</label>
						<select
							value={normalType}
							onChange={(e) => setNormalType(e.target.value as NormalType)}
							className="select select-xs select-bordered w-full"
						>
							<option value="opengl">OpenGL</option>
							<option value="directx">DirectX</option>
						</select>
					</div>

					{/* Normal scale */}
					<div title="Strength of the normal map effect">
						<label className="text-xs text-base-content/50 mb-0.5 block">
							Normal Scale: {normalScale.toFixed(2)}
						</label>
						<input
							type="range"
							min="0"
							max="5"
							step="0.05"
							value={normalScale}
							onChange={(e) => setNormalScale(Number.parseFloat(e.target.value))}
							className="range range-primary range-xs w-full"
						/>
					</div>

					{/* Displacement scale */}
					<div title="Strength of displacement mapping (vertex offset)">
						<label className="text-xs text-base-content/50 mb-0.5 block">
							Displacement Scale: {displacementScale.toFixed(3)}
						</label>
						<input
							type="range"
							min="0"
							max="0.33"
							step="0.005"
							value={displacementScale}
							onChange={(e) => setDisplacementScale(Number.parseFloat(e.target.value))}
							className="range range-primary range-xs w-full"
						/>
					</div>

					{/* Tiling scale */}
					<div title="UV repeat factor for the texture">
						<label className="text-xs text-base-content/50 mb-0.5 block">
							Tiling Scale: {tilingScale.toFixed(1)}
						</label>
						<input
							type="range"
							min="0.1"
							max="10"
							step="0.1"
							value={tilingScale}
							onChange={(e) => setTilingScale(Number.parseFloat(e.target.value))}
							className="range range-primary range-xs w-full"
						/>
					</div>

					{/* Clay render */}
					<label
						className="flex items-center gap-2 cursor-pointer"
						title="Disable color map to inspect shape and lighting only"
					>
						<input
							type="checkbox"
							checked={clayRender}
							onChange={(e) => setClayRender(e.target.checked)}
							className="checkbox checkbox-xs checkbox-primary"
						/>
						<span className="text-xs text-base-content/60">Clay Render</span>
					</label>
				</div>
			</div>

			{/* 3D Preview — PBR.ONE iframe */}
			<div className="flex-1 min-w-0 relative bg-[#1a1a2e]">
				<iframe
					ref={iframeRef}
					src="/pbr-one/material-shading.html#watermark_enable=0&gui_enable=-1&fullscreen_enable=0"
					className="w-full h-full border-none"
					title="3D Material Preview"
				/>
				{!iframeReady && (
					<div className="absolute inset-0 flex items-center justify-center bg-base-100/80">
						<span className="loading loading-spinner loading-md text-primary" />
					</div>
				)}
			</div>
		</div>
	);
}
