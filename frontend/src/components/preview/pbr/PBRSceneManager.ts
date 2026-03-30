import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import type { MapKey, PBRSceneConfig } from "@/types/pbr";
import { MAP_KEYS } from "@/types/pbr";
import {
	MAP_NAMES,
	MAP_COLOR_SPACE,
	MAP_ACTIVE_SETTINGS,
	MAP_INACTIVE_SETTINGS,
	NORMAL_MAP_TYPE,
	TILING_RATIO_FACTOR,
} from "./constants";

export class PBRSceneManager {
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private renderer: THREE.WebGLRenderer;
	private mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
	private controls: OrbitControls;
	private textureLoader: THREE.TextureLoader;
	private exrLoader: EXRLoader;
	private animationId: number | null = null;
	private currentConfig: PBRSceneConfig | null = null;
	private container: HTMLDivElement;
	private onReady: () => void;

	constructor(container: HTMLDivElement, onReady: () => void) {
		this.container = container;
		this.onReady = onReady;

		// Scene
		this.scene = new THREE.Scene();

		// Camera
		this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
		this.camera.position.z = 2;
		this.camera.position.y = 1;

		// Renderer
		this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		container.appendChild(this.renderer.domElement);

		// Mesh with default plane geometry
		const material = new THREE.MeshPhysicalMaterial();
		this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), material);
		this.scene.add(this.mesh);

		// Controls
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;

		// Loaders
		this.textureLoader = new THREE.TextureLoader();
		this.exrLoader = new EXRLoader();

		// Initial size
		this.resize();

		// Load placeholder environment, then signal ready
		this.loadEnvironment("/assets/environments/env-placeholder.exr", () => {
			this.onReady();
		});

		// Start animation loop
		this.animate();
	}

	updateConfig(newConfig: PBRSceneConfig): void {
		const oldConfig = this.currentConfig;
		this.currentConfig = newConfig;

		if (!oldConfig) {
			// First config — apply everything
			this.updateGeometry(newConfig);
			this.updateAllTextures(newConfig);
			this.updateEnvironment(newConfig.environment);
			this.updateNormalScale(newConfig);
			this.updateDisplacement(newConfig);
			return;
		}

		if (oldConfig.geometry !== newConfig.geometry || oldConfig.geometrySubdivisions !== newConfig.geometrySubdivisions) {
			this.updateGeometry(newConfig);
		}

		// Check each texture slot + clay render toggle
		const texturesChanged = MAP_KEYS.some((k) => oldConfig.textures[k] !== newConfig.textures[k]);
		const clayChanged = oldConfig.clayRender !== newConfig.clayRender;
		if (texturesChanged || clayChanged) {
			this.updateAllTextures(newConfig, oldConfig);
		}

		// Tiling or geometry change requires re-applying UV repeat on existing textures
		if (oldConfig.tilingScale !== newConfig.tilingScale || oldConfig.geometry !== newConfig.geometry) {
			this.updateTiling(newConfig);
		}

		if (oldConfig.environment !== newConfig.environment) {
			this.updateEnvironment(newConfig.environment);
		}

		if (oldConfig.normalType !== newConfig.normalType || oldConfig.normalScale !== newConfig.normalScale) {
			this.updateNormalScale(newConfig);
		}

		if (oldConfig.displacementScale !== newConfig.displacementScale) {
			this.updateDisplacement(newConfig);
		}
	}

	resize(): void {
		const w = this.container.clientWidth;
		const h = this.container.clientHeight;
		if (w === 0 || h === 0) return;
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(w, h);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	}

	/** Render one frame and capture the viewport as a base64 PNG (no data: prefix). */
	captureViewport(): string {
		this.renderer.render(this.scene, this.camera);
		const dataUrl = this.renderer.domElement.toDataURL("image/png");
		return dataUrl.replace(/^data:image\/png;base64,/, "");
	}

	dispose(): void {
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
		this.controls.dispose();

		// Dispose all textures on the material
		const mat = this.mesh.material;
		for (const key of MAP_KEYS) {
			const propName = MAP_NAMES[key];
			const tex = (mat as unknown as Record<string, unknown>)[propName] as THREE.Texture | null;
			tex?.dispose();
		}
		mat.dispose();
		this.mesh.geometry.dispose();

		// Dispose environment
		if (this.scene.environment) {
			this.scene.environment.dispose();
		}

		this.renderer.dispose();
		this.renderer.domElement.remove();
	}

	// -----------------------------------------------------------------------
	// Private
	// -----------------------------------------------------------------------

	private animate = (): void => {
		this.animationId = requestAnimationFrame(this.animate);
		this.controls.update();
		this.renderer.render(this.scene, this.camera);
	};

	private updateGeometry(config: PBRSceneConfig): void {
		const subs = config.geometrySubdivisions;
		let geometry: THREE.BufferGeometry;
		let side: THREE.Side = THREE.FrontSide;
		let rx = 0;
		let ry = 0;
		let rz = 0;

		switch (config.geometry) {
			case "cube":
				geometry = new THREE.BoxGeometry(1, 1, 1, subs, subs, subs);
				break;
			case "cylinder":
				geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, subs, subs, true);
				side = THREE.DoubleSide;
				ry = Math.PI;
				break;
			case "sphere":
				geometry = new THREE.SphereGeometry(0.5, subs, subs);
				break;
			case "torus":
				geometry = new THREE.TorusGeometry(0.5, 0.25, subs, subs);
				rx = 0.5 * Math.PI;
				break;
			case "plane":
			default:
				geometry = new THREE.PlaneGeometry(1, 1, subs, subs);
				side = THREE.DoubleSide;
				rx = 1.5 * Math.PI;
				break;
		}

		this.mesh.geometry.dispose();
		this.mesh.geometry = geometry;
		this.mesh.material.side = side;
		this.mesh.rotation.set(rx, ry, rz);
	}

	private updateAllTextures(config: PBRSceneConfig, oldConfig?: PBRSceneConfig): void {
		const mat = this.mesh.material as unknown as Record<string, unknown>;
		const ratioFactor = TILING_RATIO_FACTOR[config.geometry];

		for (const mapKey of MAP_KEYS) {
			let newUrl = config.textures[mapKey];
			const oldUrl = oldConfig?.textures[mapKey] ?? undefined;

			// Clay render disables the color map
			if (mapKey === "color" && config.clayRender) {
				newUrl = null;
			}

			// Also account for clay render toggling even if the underlying URL didn't change
			const clayToggled = mapKey === "color" && oldConfig && oldConfig.clayRender !== config.clayRender;
			if (oldUrl === newUrl && !clayToggled && oldConfig) continue;

			const propName = MAP_NAMES[mapKey];

			// Dispose old texture
			const oldTex = mat[propName] as THREE.Texture | null;
			if (oldTex) {
				oldTex.dispose();
				mat[propName] = null;
			}

			if (newUrl) {
				const texture = this.textureLoader.load(newUrl, (tex) => {
					// Set UV tiling based on texture aspect ratio
					const data = tex.source.data as { width: number; height: number };
					const ratio = (data.width / data.height) * ratioFactor;
					if (ratio > 1) {
						tex.repeat.set(config.tilingScale, config.tilingScale * ratio);
					} else {
						tex.repeat.set(config.tilingScale / ratio, config.tilingScale);
					}
				});
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.colorSpace = MAP_COLOR_SPACE[mapKey];

				mat[propName] = texture;

				// Apply active settings (e.g. set color to white so it doesn't tint)
				const active = MAP_ACTIVE_SETTINGS[mapKey];
				if (active) {
					mat[active[0]] = active[1];
				}
				// Enable transparency only when an opacity map is present
				if (mapKey === "opacity") {
					this.mesh.material.transparent = true;
				}
			} else {
				// Apply inactive defaults
				const inactive = MAP_INACTIVE_SETTINGS[mapKey];
				if (inactive) {
					mat[inactive[0]] = inactive[1];
				}
				if (mapKey === "opacity") {
					this.mesh.material.transparent = false;
				}
			}

			mat.needsUpdate = true;
		}
	}

	private updateTiling(config: PBRSceneConfig): void {
		const mat = this.mesh.material as unknown as Record<string, unknown>;
		const ratioFactor = TILING_RATIO_FACTOR[config.geometry];

		for (const mapKey of MAP_KEYS) {
			const propName = MAP_NAMES[mapKey];
			const tex = mat[propName] as THREE.Texture | null;
			if (!tex) continue;
			const data = tex.source?.data as { width: number; height: number } | undefined;
			if (!data) continue;

			const ratio = (data.width / data.height) * ratioFactor;
			if (ratio > 1) {
				tex.repeat.set(config.tilingScale, config.tilingScale * ratio);
			} else {
				tex.repeat.set(config.tilingScale / ratio, config.tilingScale);
			}
		}
	}

	private updateEnvironment(envName: string, onDone?: () => void): void {
		const url = `/assets/environments/env-${envName}-lq.exr`;
		this.loadEnvironment(url, onDone);
	}

	private loadEnvironment(url: string, onDone?: () => void): void {
		this.exrLoader.load(url, (texture) => {
			const gen = new THREE.PMREMGenerator(this.renderer);
			const envMap = gen.fromEquirectangular(texture).texture;

			// Dispose old environment
			if (this.scene.environment) {
				this.scene.environment.dispose();
			}

			this.scene.environment = envMap;
			this.scene.background = envMap;
			texture.dispose();
			gen.dispose();
			onDone?.();
		});
	}

	private updateNormalScale(config: PBRSceneConfig): void {
		const dir = NORMAL_MAP_TYPE[config.normalType];
		this.mesh.material.normalScale = new THREE.Vector2(
			config.normalScale,
			config.normalScale,
		).multiply(dir);
	}

	private updateDisplacement(config: PBRSceneConfig): void {
		this.mesh.material.displacementBias = config.displacementScale / -2;
		this.mesh.material.displacementScale = config.displacementScale;
	}
}
