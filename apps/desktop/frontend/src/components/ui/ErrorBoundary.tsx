import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("ErrorBoundary caught:", error, info);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex flex-col items-center justify-center h-full gap-4 p-8">
					<h2 className="text-xl font-bold text-error">Something went wrong</h2>
					<p className="text-sm text-base-content/60 max-w-md text-center">
						{this.state.error?.message ?? "An unexpected error occurred."}
					</p>
					<button
						type="button"
						className="btn btn-primary btn-sm"
						onClick={() => this.setState({ hasError: false, error: null })}
					>
						Try again
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}
