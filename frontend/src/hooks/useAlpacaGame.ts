import { useState, useRef, useCallback, useEffect } from "react";

const GRAVITY = 1800;
const MOVE_SPEED = 350;
const JUMP_VELOCITY = -600;
const GROUND_FRICTION = 0.75;
const SPRITE_SIZE = 120; // size-30 = 7.5rem = 120px
const BACKFLIP_SPEED = 480; // degrees/sec
const WOBBLE_FREQ = 3; // oscillations/sec
const WOBBLE_AMPLITUDE = 12; // degrees
const RETURN_DURATION = 0.6; // seconds
const RETURN_ARC_HEIGHT = 250; // pixels above the straight-line path

interface Position {
	x: number;
	y: number;
}

type Facing = "left" | "right";

export default function useAlpacaGame() {
	const [active, setActive] = useState(false);
	const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
	const [facing, setFacing] = useState<Facing>("right");
	const [rotation, setRotation] = useState(0);

	const containerRef = useRef<HTMLDivElement>(null);
	const logoRef = useRef<HTMLImageElement>(null);

	const stateRef = useRef({
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		grounded: false,
		facing: "right" as Facing,
		backflipping: false,
		backflipAngle: 0,
		wobbleTime: 0,
		// Origin (where the logo sits in the layout)
		originX: 0,
		originY: 0,
		// Return animation
		returning: false,
		returnProgress: 0,
		returnStartX: 0,
		returnStartY: 0,
	});
	const keysRef = useRef(new Set<string>());
	const rafRef = useRef<number>(0);
	const lastTimeRef = useRef(0);

	const finishDeactivate = useCallback(() => {
		setActive(false);
		cancelAnimationFrame(rafRef.current);
		lastTimeRef.current = 0;
		keysRef.current.clear();
	}, []);

	const loop = useCallback((time: number) => {
		if (!containerRef.current) return;

		const dt = lastTimeRef.current ? Math.min((time - lastTimeRef.current) / 1000, 0.05) : 1 / 60;
		lastTimeRef.current = time;

		const s = stateRef.current;

		// Return animation (tween back to origin with arc + backflip)
		if (s.returning) {
			s.returnProgress = Math.min(s.returnProgress + dt / RETURN_DURATION, 1);
			// Ease-out quad
			const t = 1 - (1 - s.returnProgress) * (1 - s.returnProgress);

			s.x = s.returnStartX + (s.originX - s.returnStartX) * t;
			const linearY = s.returnStartY + (s.originY - s.returnStartY) * t;
			// Parabolic arc (peaks at t=0.5)
			const arc = RETURN_ARC_HEIGHT * 4 * t * (1 - t);
			s.y = linearY - arc;

			const rot = -360 * t;

			setPosition({ x: s.x, y: s.y });
			setFacing("right");
			setRotation(rot);

			if (s.returnProgress >= 1) {
				finishDeactivate();
				return;
			}

			rafRef.current = requestAnimationFrame(loop);
			return;
		}

		const keys = keysRef.current;
		const bounds = containerRef.current.getBoundingClientRect();
		const maxX = bounds.width - SPRITE_SIZE;
		const maxY = bounds.height - SPRITE_SIZE;

		// Horizontal input
		let inputX = 0;
		if (keys.has("ArrowLeft") || keys.has("a")) inputX -= 1;
		if (keys.has("ArrowRight") || keys.has("d")) inputX += 1;

		if (inputX !== 0) {
			s.vx = inputX * MOVE_SPEED;
			s.facing = inputX < 0 ? "left" : "right";
		} else {
			s.vx *= GROUND_FRICTION;
			if (Math.abs(s.vx) < 1) s.vx = 0;
		}

		// Jump
		if (
			s.grounded &&
			(keys.has("ArrowUp") || keys.has("w") || keys.has(" "))
		) {
			s.vy = JUMP_VELOCITY;
			s.grounded = false;
		}

		// Gravity
		s.vy += GRAVITY * dt;

		// Update position
		s.x += s.vx * dt;
		s.y += s.vy * dt;

		// Collision: floor
		if (s.y >= maxY) {
			s.y = maxY;
			s.vy = 0;
			s.grounded = true;
			if (s.backflipping) {
				s.backflipping = false;
				s.backflipAngle = 0;
			}
		}

		// Collision: ceiling
		if (s.y < 0) {
			s.y = 0;
			s.vy = 0;
		}

		// Collision: walls
		if (s.x < 0) {
			s.x = 0;
			s.vx = 0;
		} else if (s.x > maxX) {
			s.x = maxX;
			s.vx = 0;
		}

		// Rotation: backflip or wobble
		let rot = 0;
		if (s.backflipping) {
			s.backflipAngle -= BACKFLIP_SPEED * dt;
			if (s.backflipAngle <= -360) {
				s.backflipAngle = 0;
				s.backflipping = false;
			}
			rot = s.backflipAngle;
		} else if (Math.abs(s.vx) > 5) {
			s.wobbleTime += dt;
			rot = Math.sin(s.wobbleTime * WOBBLE_FREQ * Math.PI * 2) * WOBBLE_AMPLITUDE;
		} else {
			s.wobbleTime = 0;
		}

		setPosition({ x: s.x, y: s.y });
		setFacing(s.facing);
		setRotation(rot);

		rafRef.current = requestAnimationFrame(loop);
	}, [finishDeactivate]);

	const activate = useCallback(() => {
		if (!containerRef.current || !logoRef.current) return;

		const containerRect = containerRef.current.getBoundingClientRect();
		const logoRect = logoRef.current.getBoundingClientRect();

		const startX = logoRect.left - containerRect.left;
		const startY = logoRect.top - containerRect.top;

		stateRef.current = {
			x: startX,
			y: startY,
			vx: 0,
			vy: 0,
			grounded: false,
			facing: "right",
			backflipping: true,
			backflipAngle: 0,
			wobbleTime: 0,
			originX: startX,
			originY: startY,
			returning: false,
			returnProgress: 0,
			returnStartX: 0,
			returnStartY: 0,
		};

		setPosition({ x: startX, y: startY });
		setFacing("right");
		setRotation(0);
		setActive(true);
	}, []);

	const deactivate = useCallback(() => {
		const s = stateRef.current;
		if (s.returning) return;
		s.returning = true;
		s.returnProgress = 0;
		s.returnStartX = s.x;
		s.returnStartY = s.y;
		keysRef.current.clear();
	}, []);

	// Physics loop
	useEffect(() => {
		if (!active) return;

		lastTimeRef.current = 0;
		rafRef.current = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(rafRef.current);
			lastTimeRef.current = 0;
		};
	}, [active, loop]);

	// Keyboard input
	useEffect(() => {
		if (!active) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				deactivate();
				return;
			}
			const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
			if (["ArrowLeft", "ArrowRight", "ArrowUp", "a", "d", "w", " "].includes(key)) {
				e.preventDefault();
				keysRef.current.add(key);
			}
		};

		const onKeyUp = (e: KeyboardEvent) => {
			const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
			keysRef.current.delete(key);
		};

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);

		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			keysRef.current.clear();
		};
	}, [active, deactivate]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			cancelAnimationFrame(rafRef.current);
		};
	}, []);

	return { active, position, facing, rotation, containerRef, logoRef, activate, deactivate };
}
