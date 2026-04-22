/**
 * Keyword database for matching texture role names to filename patterns.
 * Each entry maps a canonical role name to a list of filename keywords.
 * Used by both pack auto-detect and material preview autofill.
 */
const ROLE_KEYWORDS: Record<string, string[]> = {
	// Color/albedo
	color: ["color", "albedo", "basecolor", "base_color", "diffuse", "diff"],
	// Normal
	normal: ["normal", "norm", "nrm"],
	// Roughness
	roughness: ["roughness", "rough"],
	// Smoothness (inverse of roughness)
	smoothness: ["smoothness", "smooth", "gloss", "glossiness"],
	// Metallic/metalness
	metallic: ["metalness", "metallic", "metal"],
	// Ambient occlusion
	ao: ["ambientocclusion", "ao", "occlusion"],
	// Displacement/height
	displacement: ["displacement", "disp", "height", "heightmap"],
	// Opacity/alpha
	opacity: ["opacity", "alpha", "transparency", "mask"],
	// Detail
	detail: ["detail", "detailmask", "detail_mask"],
	// Emissive
	emissive: ["emissive", "emission", "glow"],
};

/**
 * Given a preset channel label (e.g., "Metallic", "AO", "Roughness"),
 * find keywords that should match filenames for that concept.
 */
export function keywordsForLabel(label: string): string[] {
	const lower = label.toLowerCase().replace(/[\s_-]+/g, "");

	// Direct match against role names
	for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
		if (lower === role || keywords.some((kw) => lower === kw || lower.includes(kw))) {
			return keywords;
		}
	}

	// Fallback: use the label itself as a keyword
	return [lower];
}

/**
 * Score how well a filename matches a set of keywords.
 * Returns 0 for no match, higher for better matches.
 * Prefers matches at word boundaries (after _, -, or case transitions).
 */
export function matchFilename(filename: string, keywords: string[]): number {
	const lower = filename.toLowerCase();
	// Strip extension
	const stem = lower.replace(/\.[^.]+$/, "");
	// Split into segments by common separators
	const segments = stem.split(/[_\-.\s]+/);

	for (const keyword of keywords) {
		// Exact segment match is highest priority
		if (segments.includes(keyword)) return 3;
		// Substring match in stem
		if (stem.includes(keyword)) return 2;
	}
	return 0;
}

/**
 * Given a list of file paths and a preset label, find the best matching file.
 */
export function findBestMatch(filePaths: string[], label: string): string | null {
	const keywords = keywordsForLabel(label);
	let bestPath: string | null = null;
	let bestScore = 0;

	for (const path of filePaths) {
		const filename = path.split(/[\\/]/).pop() ?? "";
		const score = matchFilename(filename, keywords);
		if (score > bestScore) {
			bestScore = score;
			bestPath = path;
		}
	}

	return bestPath;
}
