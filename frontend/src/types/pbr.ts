export type GeometryType = "plane" | "cube" | "sphere" | "cylinder" | "torus";
export type NormalType = "opengl" | "directx";

export const MAP_KEYS = [
	"color",
	"normal",
	"roughness",
	"metalness",
	"ambientocclusion",
	"displacement",
	"opacity",
] as const;

export type MapKey = (typeof MAP_KEYS)[number];

export interface PBRSceneConfig {
	geometry: GeometryType;
	geometrySubdivisions: number;
	environment: string;
	normalType: NormalType;
	normalScale: number;
	displacementScale: number;
	tilingScale: number;
	clayRender: boolean;
	textures: Record<MapKey, string | null>;
}

export interface PBRSceneStatus {
	ready: boolean;
}
