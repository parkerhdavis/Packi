import { useSettingsStore } from "@/stores/settingsStore";
import { openUrl } from "@tauri-apps/plugin-opener";

export default function AboutPanel() {
	const theme = useSettingsStore((s) => s.settings.theme);

	return (
		<div className="p-6 max-w-lg">
			<div className="flex items-start gap-3">
				<img
					src={theme === "light" ? "/packi-splash-light.png" : "/packi-splash-dark.png"}
					alt="Packi"
					className="size-20 shrink-0"
				/>
				<div className="text-sm text-base-content/60 space-y-1">
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
	);
}
