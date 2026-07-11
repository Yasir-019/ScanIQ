import { useRef, useState } from "react";
import { getScannerService, type ZoomCapabilities } from "@/lib/scanner-service";

export function usePinchToZoom(zoomCaps: ZoomCapabilities | null) {
  const [zoom, setZoom] = useState(1);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const rafRef = useRef<number | null>(null);
  const pendingZoomRef = useRef<number | null>(null);

  const applyZoom = (next: number) => {
    if (!zoomCaps) return;
    const clamped = Math.max(zoomCaps.min, Math.min(zoomCaps.max, next));
    setZoom(clamped);
    pendingZoomRef.current = clamped;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const v = pendingZoomRef.current;
        if (v != null) {
          getScannerService().setZoom(v).catch(() => {
            // Silently swallow runtime camera setZoom errors
          });
        }
      });
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && zoomCaps) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchStartDistRef.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchStartZoomRef.current = zoom;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current && zoomCaps) {
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / pinchStartDistRef.current;
      applyZoom(pinchStartZoomRef.current * ratio);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchStartDistRef.current = null;
    }
  };

  return {
    zoom,
    setZoom,
    applyZoom,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
