import { useUndoStore } from "@/stores/undoStore";
import { useAppStore } from "@/stores/appStore";
import { LuPanelRightClose, LuUndo2, LuRedo2 } from "react-icons/lu";

export default function HistorySidebar() {
	const undoStack = useUndoStore((s) => s.undoStack);
	const redoStack = useUndoStore((s) => s.redoStack);
	const jumpTo = useUndoStore((s) => s.jumpTo);
	const busy = useUndoStore((s) => s.busy);
	const toggleHistorySidebar = useAppStore((s) => s.toggleHistorySidebar);

	// Redo stack is stored in reverse (last element = most recently undone),
	// so reverse it for display (most recently undone closest to "now").
	const redoItems = [...redoStack].reverse();

	return (
		<div className="w-56 shrink-0 flex flex-col border-l border-base-300 bg-base-200/30 overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-base-300 shrink-0">
				<span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
					History
				</span>
				<button
					type="button"
					onClick={toggleHistorySidebar}
					className="btn btn-ghost btn-xs h-6 min-h-0 px-1.5"
					title="Close history (Ctrl+\)"
				>
					<LuPanelRightClose size={14} />
				</button>
			</div>

			{/* History list */}
			<div className="flex-1 overflow-y-auto">
				{undoStack.length === 0 && redoStack.length === 0 && (
					<div className="px-3 py-6 text-xs text-base-content/30 text-center">
						No history yet
					</div>
				)}

				{/* Undo stack (past actions) */}
				{undoStack.map((action, i) => (
					<button
						key={`undo-${i}-${action.timestamp}`}
						type="button"
						disabled={busy}
						onClick={() => jumpTo(i)}
						className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs cursor-pointer transition-colors hover:bg-base-300/50 text-base-content/70"
					>
						<LuUndo2 size={11} className="shrink-0 opacity-40" />
						<span className="truncate">{action.description}</span>
					</button>
				))}

				{/* Current state marker */}
				{(undoStack.length > 0 || redoStack.length > 0) && (
					<div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary">
						<div className="size-1.5 rounded-full bg-primary shrink-0" />
						<span>Current</span>
					</div>
				)}

				{/* Redo stack (future actions, dimmed) */}
				{redoItems.map((action, i) => (
					<button
						key={`redo-${i}-${action.timestamp}`}
						type="button"
						disabled={busy}
						onClick={() => jumpTo(undoStack.length + i + 1)}
						className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs cursor-pointer transition-colors hover:bg-base-300/50 text-base-content/30"
					>
						<LuRedo2 size={11} className="shrink-0 opacity-40" />
						<span className="truncate">{action.description}</span>
					</button>
				))}
			</div>
		</div>
	);
}
