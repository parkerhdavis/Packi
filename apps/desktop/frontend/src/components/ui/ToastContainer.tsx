import { useToastStore } from "@/stores/toastStore";
import { LuX } from "react-icons/lu";

const typeClasses: Record<string, string> = {
	info: "alert-info",
	success: "alert-success",
	warning: "alert-warning",
	error: "alert-error",
};

export default function ToastContainer() {
	const toasts = useToastStore((s) => s.toasts);
	const removeToast = useToastStore((s) => s.removeToast);

	if (toasts.length === 0) return null;

	return (
		<div className="fixed bottom-10 right-4 z-50 flex flex-col gap-2 max-w-sm">
			{toasts.map((toast) => (
				<div
					key={toast.id}
					className={`alert ${typeClasses[toast.type] ?? ""} shadow-lg text-sm py-2 px-3`}
				>
					<span className="flex-1">{toast.message}</span>
					<button
						type="button"
						className="btn btn-ghost btn-xs"
						onClick={() => removeToast(toast.id)}
					>
						<LuX size={14} />
					</button>
				</div>
			))}
		</div>
	);
}
