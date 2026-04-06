import { describe, test, expect, beforeEach } from "bun:test";
import { useToastStore } from "./toastStore";

describe("toastStore", () => {
	beforeEach(() => {
		useToastStore.setState({ toasts: [] });
	});

	test("initial state is empty", () => {
		expect(useToastStore.getState().toasts).toEqual([]);
	});

	test("addToast adds a toast with default type", () => {
		useToastStore.getState().addToast("hello");
		const toasts = useToastStore.getState().toasts;
		expect(toasts).toHaveLength(1);
		expect(toasts[0].message).toBe("hello");
		expect(toasts[0].type).toBe("info");
		expect(toasts[0].id).toBeDefined();
	});

	test("addToast with explicit type", () => {
		useToastStore.getState().addToast("error!", "error");
		const toasts = useToastStore.getState().toasts;
		expect(toasts[0].type).toBe("error");
	});

	test("multiple toasts accumulate", () => {
		const { addToast } = useToastStore.getState();
		addToast("first");
		addToast("second");
		addToast("third");
		expect(useToastStore.getState().toasts).toHaveLength(3);
	});

	test("removeToast removes by id", () => {
		useToastStore.getState().addToast("to remove");
		const id = useToastStore.getState().toasts[0].id;
		useToastStore.getState().removeToast(id);
		expect(useToastStore.getState().toasts).toHaveLength(0);
	});

	test("removeToast with nonexistent id is noop", () => {
		useToastStore.getState().addToast("keep me");
		useToastStore.getState().removeToast("nonexistent");
		expect(useToastStore.getState().toasts).toHaveLength(1);
	});

	test("each toast gets a unique id", () => {
		const { addToast } = useToastStore.getState();
		addToast("a");
		addToast("b");
		const toasts = useToastStore.getState().toasts;
		expect(toasts[0].id).not.toBe(toasts[1].id);
	});
});
