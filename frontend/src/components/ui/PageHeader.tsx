import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	subtitle?: string;
	actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
	return (
		<div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
			<div>
				<h1 className="text-xl font-bold">{title}</h1>
				{subtitle && (
					<p className="text-sm text-base-content/50 mt-0.5">{subtitle}</p>
				)}
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</div>
	);
}
