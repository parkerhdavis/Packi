import { useSettingsStore } from "@/stores/settingsStore";

interface LoadingOverlayProps {
	/** Size of the logo icon. Defaults to 40px. */
	size?: number;
	/** Background color class. Defaults to semi-transparent base. */
	bgClass?: string;
}

export default function LoadingOverlay({
	size = 120,
	bgClass = "bg-[#0D1013]",
}: LoadingOverlayProps) {
	const theme = useSettingsStore((s) => s.settings.theme);
	const icon = theme === "light" ? "/packi-splash-light.png" : "/packi-splash-dark.png";

	return (
		<div className={`absolute inset-0 flex items-center justify-center z-10 ${bgClass}`}>
			<img
				src={icon}
				alt="Loading"
				className="animate-logo-pulse"
				style={{ width: size, height: size }}
			/>
		</div>
	);
}
