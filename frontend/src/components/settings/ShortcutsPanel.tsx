const isMac = navigator.platform.toUpperCase().includes("MAC");
const mod = isMac ? "⌘" : "Ctrl";

const shortcuts: { category: string; items: { keys: string; description: string }[] }[] = [
	{
		category: "Navigation",
		items: [
			{ keys: `${mod}+1`, description: "Switch to Adjust module" },
			{ keys: `${mod}+2`, description: "Switch to Pack module" },
			{ keys: `${mod}+3`, description: "Switch to Preview module" },
			{ keys: `${mod}+4`, description: "Switch to Size module" },
			{ keys: `${mod}+5`, description: "Switch to Batch module" },
			{ keys: `${mod}+,`, description: "Open Settings" },
			{ keys: `${mod}+/`, description: "Toggle sidebar" },
			{ keys: `${mod}+\\`, description: "Toggle history sidebar" },
		],
	},
	{
		category: "Editing",
		items: [
			{ keys: `${mod}+Z`, description: "Undo" },
			{ keys: `${mod}+Shift+Z`, description: "Redo" },
			{ keys: `${mod}+Y`, description: "Redo (alternate)" },
		],
	},
	{
		category: "View",
		items: [
			{ keys: `${mod}+=`, description: "Zoom in" },
			{ keys: `${mod}+-`, description: "Zoom out" },
			{ keys: `${mod}+0`, description: "Reset zoom" },
		],
	},
];

export default function ShortcutsPanel() {
	return (
		<div className="p-6 max-w-lg">
			<h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
			<div className="space-y-6">
				{shortcuts.map((section) => (
					<div key={section.category}>
						<h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
							{section.category}
						</h3>
						<div className="space-y-1">
							{section.items.map((item) => (
								<div key={item.keys} className="flex items-center justify-between py-1">
									<span className="text-sm text-base-content/70">{item.description}</span>
									<kbd className="kbd kbd-sm text-xs font-mono">{item.keys}</kbd>
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
