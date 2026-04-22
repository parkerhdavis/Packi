import { describe, test, expect } from "bun:test";
import { keywordsForLabel, matchFilename, findBestMatch } from "./textureDetection";

describe("textureDetection", () => {
	describe("keywordsForLabel", () => {
		test("metallic label returns metallic keywords", () => {
			const kw = keywordsForLabel("Metallic");
			expect(kw).toContain("metallic");
			expect(kw).toContain("metal");
		});

		test("AO label returns occlusion keywords", () => {
			const kw = keywordsForLabel("AO");
			expect(kw).toContain("ao");
			expect(kw).toContain("occlusion");
		});

		test("Roughness label", () => {
			const kw = keywordsForLabel("Roughness");
			expect(kw).toContain("roughness");
		});

		test("Smoothness label", () => {
			const kw = keywordsForLabel("Smoothness");
			expect(kw).toContain("smoothness");
			expect(kw).toContain("gloss");
		});

		test("unknown label falls back to itself", () => {
			const kw = keywordsForLabel("FooBar");
			expect(kw).toEqual(["foobar"]);
		});
	});

	describe("matchFilename", () => {
		test("exact segment match scores highest", () => {
			expect(matchFilename("Rock_Metallic.png", ["metallic"])).toBe(3);
		});

		test("substring match scores lower", () => {
			expect(matchFilename("RockMetallic.png", ["metallic"])).toBe(2);
		});

		test("no match returns 0", () => {
			expect(matchFilename("Rock_Color.png", ["metallic"])).toBe(0);
		});
	});

	describe("findBestMatch", () => {
		const files = [
			"/textures/Rock_BaseColor.png",
			"/textures/Rock_Metallic.png",
			"/textures/Rock_Roughness.png",
			"/textures/Rock_Normal.png",
			"/textures/Rock_AO.png",
		];

		test("finds metallic file for Metallic label", () => {
			expect(findBestMatch(files, "Metallic")).toBe("/textures/Rock_Metallic.png");
		});

		test("finds AO file for AO label", () => {
			expect(findBestMatch(files, "AO")).toBe("/textures/Rock_AO.png");
		});

		test("finds roughness file for Roughness label", () => {
			expect(findBestMatch(files, "Roughness")).toBe("/textures/Rock_Roughness.png");
		});

		test("returns null when no match", () => {
			expect(findBestMatch(files, "Emissive")).toBeNull();
		});
	});
});
