import { mock, describe, test, expect, beforeEach } from "bun:test";

// Mock Tauri APIs before importing the store
mock.module("@tauri-apps/api/core", () => ({
	invoke: async () => [],
}));
mock.module("@tauri-apps/api/event", () => ({
	listen: async () => () => {},
}));

const { useBatchStore } = await import("./batchStore");

describe("batchStore", () => {
	beforeEach(() => {
		useBatchStore.setState({
			inputFiles: [],
			pipeline: [],
			outputDir: null,
			previewItems: [],
			running: false,
			progress: null,
			result: null,
			presets: [],
		});
	});

	test("initial state", () => {
		const state = useBatchStore.getState();
		expect(state.inputFiles).toEqual([]);
		expect(state.pipeline).toEqual([]);
		expect(state.outputDir).toBeNull();
		expect(state.running).toBe(false);
	});

	// --- File management ---

	test("addFiles adds unique paths", () => {
		useBatchStore.getState().addFiles(["/a.png", "/b.png"]);
		expect(useBatchStore.getState().inputFiles).toEqual(["/a.png", "/b.png"]);
	});

	test("addFiles deduplicates", () => {
		useBatchStore.getState().addFiles(["/a.png", "/b.png"]);
		useBatchStore.getState().addFiles(["/b.png", "/c.png"]);
		expect(useBatchStore.getState().inputFiles).toEqual(["/a.png", "/b.png", "/c.png"]);
	});

	test("removeFile by index", () => {
		useBatchStore.getState().addFiles(["/a.png", "/b.png", "/c.png"]);
		useBatchStore.getState().removeFile(1);
		expect(useBatchStore.getState().inputFiles).toEqual(["/a.png", "/c.png"]);
	});

	test("clearFiles resets state", () => {
		useBatchStore.getState().addFiles(["/a.png"]);
		useBatchStore.getState().clearFiles();
		expect(useBatchStore.getState().inputFiles).toEqual([]);
		expect(useBatchStore.getState().previewItems).toEqual([]);
		expect(useBatchStore.getState().result).toBeNull();
	});

	// --- Pipeline management ---

	test("addStep appends to pipeline", () => {
		useBatchStore.getState().addStep({ type: "convert", format: "tga", bit_depth: 8 });
		useBatchStore.getState().addStep({ type: "rename", pattern: "{name}_out" });
		expect(useBatchStore.getState().pipeline).toHaveLength(2);
		expect(useBatchStore.getState().pipeline[0].type).toBe("convert");
		expect(useBatchStore.getState().pipeline[1].type).toBe("rename");
	});

	test("removeStep by index", () => {
		useBatchStore.getState().addStep({ type: "convert", format: "png8", bit_depth: 8 });
		useBatchStore.getState().addStep({ type: "rename", pattern: "test" });
		useBatchStore.getState().removeStep(0);
		expect(useBatchStore.getState().pipeline).toHaveLength(1);
		expect(useBatchStore.getState().pipeline[0].type).toBe("rename");
	});

	test("updateStep replaces at index", () => {
		useBatchStore.getState().addStep({ type: "convert", format: "png8", bit_depth: 8 });
		useBatchStore.getState().updateStep(0, { type: "convert", format: "tga", bit_depth: 8 });
		expect(useBatchStore.getState().pipeline[0].format).toBe("tga");
	});

	test("moveStep reorders pipeline", () => {
		useBatchStore.getState().addStep({ type: "convert", format: "png8", bit_depth: 8 });
		useBatchStore.getState().addStep({ type: "resize", mode: "exact", width: 512, height: 512, filter: "lanczos" });
		useBatchStore.getState().addStep({ type: "rename", pattern: "out" });

		// Move first step to last position
		useBatchStore.getState().moveStep(0, 2);
		const pipeline = useBatchStore.getState().pipeline;
		expect(pipeline[0].type).toBe("resize");
		expect(pipeline[1].type).toBe("rename");
		expect(pipeline[2].type).toBe("convert");
	});

	test("moveStep swap adjacent", () => {
		useBatchStore.getState().addStep({ type: "convert", format: "png8", bit_depth: 8 });
		useBatchStore.getState().addStep({ type: "rename", pattern: "test" });

		useBatchStore.getState().moveStep(0, 1);
		const pipeline = useBatchStore.getState().pipeline;
		expect(pipeline[0].type).toBe("rename");
		expect(pipeline[1].type).toBe("convert");
	});

	// --- Output ---

	test("setOutputDir", () => {
		useBatchStore.getState().setOutputDir("/tmp/output");
		expect(useBatchStore.getState().outputDir).toBe("/tmp/output");
	});
});
