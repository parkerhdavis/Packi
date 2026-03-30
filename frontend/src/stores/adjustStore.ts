import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { ImageInfo } from "@/types";
import type { CurvePoint } from "@/components/ui/CurveEditor";
import { useUndoStore } from "@/stores/undoStore";

// --- Operation types ---

type AdjustSection = "general" | "normals";
type GeneralOperation = "luminance-curve" | "adjust-hue" | "adjust-saturation";
type NormalOperation = "flip" | "height-to-normal" | "blend" | "normalize";
type AdjustOperation = GeneralOperation | NormalOperation;

// --- Per-operation parameter interfaces ---

interface LuminanceCurveParams {
	curveLut: number[] | null;
	curvePoints: CurvePoint[] | null;
}

interface AdjustHueParams {
	hueOffset: number;
}

interface AdjustSaturationParams {
	saturationOffset: number;
}

interface FlipParams {
	enabled: boolean;
}

interface HeightToNormalParams {
	strength: number;
}

interface BlendParams {
	secondInputPath: string | null;
	secondInputPreview: string | null;
	blendFactor: number;
}

interface NormalizeParams {
	enabled: boolean;
}

interface AllOperationParams {
	"luminance-curve": LuminanceCurveParams;
	"adjust-hue": AdjustHueParams;
	"adjust-saturation": AdjustSaturationParams;
	flip: FlipParams;
	"height-to-normal": HeightToNormalParams;
	blend: BlendParams;
	normalize: NormalizeParams;
}

// --- Defaults (source of truth for "edited" detection) ---

const OPERATION_DEFAULTS: AllOperationParams = {
	"luminance-curve": { curveLut: null, curvePoints: null },
	"adjust-hue": { hueOffset: 0 },
	"adjust-saturation": { saturationOffset: 0 },
	flip: { enabled: false },
	"height-to-normal": { strength: 1.0 },
	blend: { secondInputPath: null, secondInputPreview: null, blendFactor: 0.5 },
	normalize: { enabled: false },
};

function cloneDefaults(): AllOperationParams {
	return JSON.parse(JSON.stringify(OPERATION_DEFAULTS));
}

/** Pipeline order — operations are applied in this sequence. */
const PIPELINE_ORDER: AdjustOperation[] = [
	"luminance-curve", "adjust-hue", "adjust-saturation",
	"flip", "height-to-normal", "blend", "normalize",
];

// --- Pipeline step builders ---

interface PipelineStep {
	op: string;
	[key: string]: unknown;
}

function buildPipelineSteps(params: AllOperationParams): PipelineStep[] {
	const steps: PipelineStep[] = [];

	for (const op of PIPELINE_ORDER) {
		if (!isEdited(op, params)) continue;

		switch (op) {
			case "luminance-curve": {
				const p = params["luminance-curve"];
				if (p.curveLut) steps.push({ op: "luminance-curve", lut: p.curveLut });
				break;
			}
			case "adjust-hue": {
				const p = params["adjust-hue"];
				steps.push({ op: "adjust-hue", offset: p.hueOffset });
				break;
			}
			case "adjust-saturation": {
				const p = params["adjust-saturation"];
				steps.push({ op: "adjust-saturation", offset: p.saturationOffset });
				break;
			}
			case "flip":
				steps.push({ op: "flip" });
				break;
			case "height-to-normal": {
				const p = params["height-to-normal"];
				steps.push({ op: "height-to-normal", strength: p.strength });
				break;
			}
			case "blend": {
				const p = params.blend;
				if (p.secondInputPath) {
					steps.push({
						op: "blend",
						second_path: p.secondInputPath,
						blend_factor: p.blendFactor,
					});
				}
				break;
			}
			case "normalize":
				steps.push({ op: "normalize" });
				break;
		}
	}

	return steps;
}

// --- Helpers ---

const generalOperations: GeneralOperation[] = ["luminance-curve", "adjust-hue", "adjust-saturation"];

function sectionForOperation(op: AdjustOperation): AdjustSection {
	if ((generalOperations as string[]).includes(op)) return "general";
	return "normals";
}

function isEdited(op: AdjustOperation, params: AllOperationParams): boolean {
	const current = params[op] as unknown as Record<string, unknown>;
	const defaults = OPERATION_DEFAULTS[op] as unknown as Record<string, unknown>;
	for (const key of Object.keys(defaults)) {
		if (current[key] !== defaults[key]) return true;
	}
	return false;
}

// Human-readable labels for undo descriptions
const operationLabels: Record<AdjustOperation, string> = {
	"luminance-curve": "Luminance Curve",
	"adjust-hue": "Adjust Hue",
	"adjust-saturation": "Adjust Saturation",
	flip: "Flip Green",
	"height-to-normal": "Height to Normal",
	blend: "Blend",
	normalize: "Normalize",
};

// --- Store ---

interface AdjustState {
	activeSection: AdjustSection;
	activeOperation: AdjustOperation;
	inputPath: string | null;
	inputInfo: ImageInfo | null;
	inputPreview: string | null;
	resultPreview: string | null;
	operationParams: AllOperationParams;
	processing: boolean;
	inputLoading: boolean;
	previewLoading: boolean;

	setOperation: (op: AdjustOperation) => void;
	loadInput: (path: string) => Promise<void>;
	clearInput: () => void;
	updateParams: <T extends AdjustOperation>(
		op: T,
		partial: Partial<AllOperationParams[T]>,
		description?: string,
	) => void;
	resetOperation: (op: AdjustOperation) => void;
	isOperationEdited: (op: AdjustOperation) => boolean;
	getEditedSteps: () => PipelineStep[];
	regeneratePreview: () => void;
	exportResult: (outputPath: string, format: string) => Promise<void>;
}

let previewDebounce: ReturnType<typeof setTimeout> | null = null;

export const useAdjustStore = create<AdjustState>((set, get) => ({
	activeSection: "general",
	activeOperation: "luminance-curve",
	inputPath: null,
	inputInfo: null,
	inputPreview: null,
	resultPreview: null,
	operationParams: cloneDefaults(),
	processing: false,
	inputLoading: false,
	previewLoading: false,

	setOperation: (op) => {
		set({
			activeSection: sectionForOperation(op),
			activeOperation: op,
		});
	},

	loadInput: async (path) => {
		const oldPath = get().inputPath;
		const oldInfo = get().inputInfo;
		const oldPreview = get().inputPreview;

		set({ inputLoading: true });
		try {
			const [info, preview] = await Promise.all([
				invoke<ImageInfo>("load_image_info", { path }),
				invoke<string>("load_image_as_base64", { path, maxPreviewSize: 512 }),
			]);
			set({
				inputPath: path,
				inputInfo: info,
				inputPreview: preview,
				resultPreview: null,
				inputLoading: false,
			});

			useUndoStore.getState().push({
				description: "Load image",
				timestamp: Date.now(),
				undo: () => {
					set({ inputPath: oldPath, inputInfo: oldInfo, inputPreview: oldPreview, resultPreview: null });
					get().regeneratePreview();
				},
				redo: () => {
					set({ inputPath: path, inputInfo: info, inputPreview: preview, resultPreview: null });
					get().regeneratePreview();
				},
			});

			get().regeneratePreview();
		} catch (err) {
			console.error("Failed to load input:", err);
			set({ inputLoading: false });
		}
	},

	clearInput: () => {
		const oldPath = get().inputPath;
		const oldInfo = get().inputInfo;
		const oldPreview = get().inputPreview;

		set({
			inputPath: null,
			inputInfo: null,
			inputPreview: null,
			resultPreview: null,
		});

		if (oldPath) {
			useUndoStore.getState().push({
				description: "Clear image",
				timestamp: Date.now(),
				undo: () => {
					set({ inputPath: oldPath, inputInfo: oldInfo, inputPreview: oldPreview });
					get().regeneratePreview();
				},
				redo: () => {
					set({ inputPath: null, inputInfo: null, inputPreview: null, resultPreview: null });
				},
			});
		}
	},

	updateParams: (op, partial, description) => {
		const oldParams = { ...get().operationParams[op] };
		const newParams = { ...get().operationParams[op], ...partial };

		set({
			operationParams: {
				...get().operationParams,
				[op]: newParams,
			},
		});

		const desc = description ?? `Change ${operationLabels[op]}`;
		useUndoStore.getState().push({
			description: desc,
			timestamp: Date.now(),
			undo: () => {
				set({
					operationParams: {
						...get().operationParams,
						[op]: oldParams,
					},
				});
				get().regeneratePreview();
			},
			redo: () => {
				set({
					operationParams: {
						...get().operationParams,
						[op]: newParams,
					},
				});
				get().regeneratePreview();
			},
		});

		get().regeneratePreview();
	},

	resetOperation: (op) => {
		const oldParams = { ...get().operationParams[op] };
		const defaultParams = { ...OPERATION_DEFAULTS[op] };

		// Don't push undo if already at defaults
		if (!isEdited(op, get().operationParams)) return;

		set({
			operationParams: {
				...get().operationParams,
				[op]: { ...defaultParams },
			},
		});

		useUndoStore.getState().push({
			description: `Reset ${operationLabels[op]}`,
			timestamp: Date.now(),
			undo: () => {
				set({
					operationParams: {
						...get().operationParams,
						[op]: oldParams,
					},
				});
				get().regeneratePreview();
			},
			redo: () => {
				set({
					operationParams: {
						...get().operationParams,
						[op]: { ...defaultParams },
					},
				});
				get().regeneratePreview();
			},
		});

		get().regeneratePreview();
	},

	isOperationEdited: (op) => {
		return isEdited(op, get().operationParams);
	},

	getEditedSteps: () => {
		return buildPipelineSteps(get().operationParams);
	},

	regeneratePreview: () => {
		if (previewDebounce) clearTimeout(previewDebounce);
		previewDebounce = setTimeout(async () => {
			const { inputPath, operationParams } = get();
			if (!inputPath) {
				set({ resultPreview: null, previewLoading: false });
				return;
			}

			const steps = buildPipelineSteps(operationParams);
			if (steps.length === 0) {
				set({ resultPreview: null, previewLoading: false });
				return;
			}

			set({ previewLoading: true });

			try {
				const result = await invoke<string>("apply_adjust_pipeline", {
					path: inputPath,
					steps,
					maxPreviewSize: 1024,
				});
				set({ resultPreview: result, previewLoading: false });
			} catch (err) {
				console.error("Pipeline preview failed:", err);
				set({ previewLoading: false });
			}
		}, 300);
	},

	exportResult: async (outputPath, format) => {
		const { inputPath, operationParams } = get();
		if (!inputPath) return;

		const steps = buildPipelineSteps(operationParams);
		if (steps.length === 0) return;

		await invoke("export_pipeline_result", {
			path: inputPath,
			steps,
			outputPath,
			format,
		});
	},
}));

export { OPERATION_DEFAULTS, PIPELINE_ORDER };
export type {
	AdjustSection, AdjustOperation, GeneralOperation, NormalOperation,
	AllOperationParams, LuminanceCurveParams, AdjustHueParams, AdjustSaturationParams,
	FlipParams, HeightToNormalParams, BlendParams, NormalizeParams,
};
