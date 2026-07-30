import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent, type PointerEvent } from "react";

/**
 * Drives the "semi-circular faded wheel" conversation list.
 *
 * Model: each conversation sits at an evenly-spaced position along a
 * vertical index line. `offset` is a continuous float representing how
 * far the whole list has been scrolled — the item whose index is closest
 * to `offset` is the "active" one, sitting at the vertical apex of the
 * arc. Every other item's distance from `offset` drives:
 *   - its vertical position along a bezier-like arc (via sin/cos curve),
 *   - its horizontal bow away from the sidebar edge (the "orbit"),
 *   - its opacity/scale fade as it nears the top/bottom limits.
 *
 * Interactions supported:
 *   - mouse wheel (deltaY) over the track
 *   - click-drag / touch-swipe vertically
 *   - momentum + spring "snap to nearest" on release
 */

export interface OrbitItemLayout {
  index: number;
  distance: number; // signed distance from the active center, in item-units
  translateY: number; // px, relative to track center
  translateX: number; // px, the "bow" curving away from the edge
  scale: number;
  opacity: number;
  isActive: boolean;
}

interface UseOrbitalWheelOptions {
  itemCount: number;
  itemSpacing?: number; // px between item centers at distance 1
  maxVisibleDistance?: number; // beyond this, items are fully faded (opacity 0)
  bowStrength?: number; // px, how far the arc bows outward at distance 0
}

export function useOrbitalWheel({
  itemCount,
  itemSpacing = 74,
  maxVisibleDistance = 3.4,
  bowStrength = 26,
}: UseOrbitalWheelOptions) {
  const [offset, setOffset] = useState(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const lastPointerYRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const snapTargetRef = useRef<number | null>(null);

  const clampOffset = useCallback(
    (value: number) => {
      if (itemCount <= 1) return 0;
      return Math.max(0, Math.min(itemCount - 1, value));
    },
    [itemCount]
  );

  // Inertial animation loop: applies velocity decay, then eases toward a
  // snap target once velocity has bled off, for a natural 60fps deceleration.
  const tick = useCallback(() => {
    setOffset((prev) => {
      let next = prev;

      if (Math.abs(velocityRef.current) > 0.01) {
        next = clampOffset(prev + velocityRef.current);
        velocityRef.current *= 0.92; // friction
        if (next === 0 || next === itemCount - 1) velocityRef.current = 0;
      } else if (snapTargetRef.current !== null) {
        const target = snapTargetRef.current;
        const delta = target - prev;
        if (Math.abs(delta) < 0.002) {
          next = target;
          snapTargetRef.current = null;
        } else {
          next = prev + delta * 0.18; // spring ease
        }
      }

      return next;
    });

    rafRef.current = requestAnimationFrame(tick);
  }, [clampOffset, itemCount]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  const requestSnap = useCallback(() => {
    if (!draggingRef.current && Math.abs(velocityRef.current) < 0.01) {
      snapTargetRef.current = Math.round(offset);
    }
  }, [offset]);

  const wheelTimeoutRef = useRef<number | null>(null);

  // Wheel handler (desktop mouse scroll)
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      snapTargetRef.current = null;
      const delta = e.deltaY / itemSpacing;
      velocityRef.current += delta * 0.5;
      setOffset((prev) => clampOffset(prev + delta * 0.5));
      if (wheelTimeoutRef.current) window.clearTimeout(wheelTimeoutRef.current);
      wheelTimeoutRef.current = window.setTimeout(requestSnap, 120);
    },
    [clampOffset, itemSpacing, requestSnap]
  );

  // Pointer drag handlers (mouse + touch, vertical swipe)
  const onPointerDown = useCallback((e: PointerEvent) => {
    draggingRef.current = true;
    velocityRef.current = 0;
    snapTargetRef.current = null;
    lastPointerYRef.current = e.clientY;
    lastMoveTimeRef.current = performance.now();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const now = performance.now();
      const dy = e.clientY - lastPointerYRef.current;
      const dt = Math.max(1, now - lastMoveTimeRef.current);
      const delta = -dy / itemSpacing;

      velocityRef.current = (delta / dt) * 16; // normalize to ~frame units
      setOffset((prev) => clampOffset(prev + delta));

      lastPointerYRef.current = e.clientY;
      lastMoveTimeRef.current = now;
    },
    [clampOffset, itemSpacing]
  );

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
    window.setTimeout(requestSnap, 80);
  }, [requestSnap]);

  const goTo = useCallback(
    (index: number) => {
      velocityRef.current = 0;
      snapTargetRef.current = clampOffset(index);
    },
    [clampOffset]
  );

  const layouts = useMemo<OrbitItemLayout[]>(() => {
    const result: OrbitItemLayout[] = [];
    for (let i = 0; i < itemCount; i++) {
      const distance = i - offset;
      const absDist = Math.abs(distance);
      const clamped = Math.min(absDist, maxVisibleDistance);
      const t = clamped / maxVisibleDistance; // 0 at center, 1 at fade limit

      // Arc: vertical spacing grows slightly toward the edges (bezier-ish
      // easing) while horizontal bow shrinks — items tuck toward the
      // sidebar edge as they leave center, creating the "wheel" curvature.
      const translateY = distance * itemSpacing * (1 + t * 0.15);
      const translateX = -bowStrength * (1 - t * t); // bow inward as it fades
      const scale = 1.2 - t * 0.4; // 1.2 at center -> 0.8 at edge
      const opacity = absDist > maxVisibleDistance ? 0 : 1 - t * 0.7; // 1 -> 0.3

      result.push({
        index: i,
        distance,
        translateY,
        translateX,
        scale,
        opacity,
        isActive: absDist < 0.5,
      });
    }
    return result;
  }, [itemCount, offset, itemSpacing, maxVisibleDistance, bowStrength]);

  return {
    offset,
    activeIndex: Math.round(clampOffset(offset)),
    layouts,
    goTo,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp },
  };
}
