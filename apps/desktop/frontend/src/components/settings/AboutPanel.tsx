import { useSettingsStore } from "@/stores/settingsStore";
import { openUrl } from "@tauri-apps/plugin-opener";
import useAlpacaGame from "@/hooks/useAlpacaGame";

export default function AboutPanel() {
	const theme = useSettingsStore((s) => s.settings.theme);
	const { active, position, facing, rotation, containerRef, logoRef, activate } = useAlpacaGame();

	const logoSrc = theme === "light" ? "/packi-splash-light.png" : "/packi-splash-dark.png";

	return (
		<div ref={containerRef} className="relative h-full overflow-hidden">
			<div className="p-8 max-w-xl">
				<div className="flex items-start gap-6">
					{active ? (
						<div className="size-30 shrink-0" />
					) : (
						<img
							ref={logoRef}
							src={logoSrc}
							alt="Packi"
							className="size-30 shrink-0 cursor-pointer select-none"
							onClick={activate}
							draggable={false}
						/>
					)}
					<div className="text-sm text-base-content/60 my-4 space-y-4">
						<p><strong>Packi</strong> v{__APP_VERSION__}</p>
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
			</div>

			{active && (
				<img
					src={logoSrc}
					alt="Packi"
					className="size-30 absolute pointer-events-none select-none"
					draggable={false}
					style={{
						left: position.x,
						top: position.y,
						transform: `${facing === "left" ? "scaleX(-1) " : ""}rotate(${rotation}deg)`,
					}}
				/>
			)}
		</div>
	);
}
