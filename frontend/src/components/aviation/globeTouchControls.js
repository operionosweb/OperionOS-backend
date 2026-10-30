import Cartesian2 from "@cesium/engine/Source/Core/Cartesian2.js";
import SceneMode from "@cesium/engine/Source/Scene/SceneMode.js";

// Keep mouse controls with Cesium. Touch uses a cooperative two-finger gesture
// so dragging one finger cannot accidentally move the globe; taps still pick.
export function attachGlobeTouchControls(viewer, onTap) {
  const canvas = viewer.canvas;
  const pointers = new Map();
  const previousTouchAction = canvas.style.touchAction;
  let previous = null;
  let start = null;
  let gestureUsed = false;
  canvas.style.touchAction = "none";
  canvas.dataset.touchNavigation = "two-finger";

  function geometry() {
    const [first, second] = [...pointers.values()];
    if (!first || !second) return null;
    return {
      x: (first.x + second.x) / 2, y: (first.y + second.y) / 2,
      distance: Math.hypot(second.x - first.x, second.y - first.y),
      angle: Math.atan2(second.y - first.y, second.x - first.x),
    };
  }

  function handle(event) {
    if (event.pointerType !== "touch") return;
    event.stopImmediatePropagation();
    if (event.cancelable) event.preventDefault();
    if (event.type === "pointerdown") {
      if (!pointers.size) {
        start = { x: event.clientX, y: event.clientY, time: event.timeStamp };
        gestureUsed = false;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      if (pointers.size >= 2) { gestureUsed = true; previous = geometry(); }
      return;
    }
    if (!pointers.has(event.pointerId)) return;
    if (event.type === "pointermove") {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) gestureUsed = true;
      const current = geometry();
      if (current && previous && pointers.size === 2 && viewer.scene.mode !== SceneMode.MORPHING) {
        const camera = viewer.camera;
        const height = Math.max(500, camera.positionCartographic.height);
        const dx = (current.x - previous.x) / Math.max(canvas.clientWidth, 1);
        const dy = (current.y - previous.y) / Math.max(canvas.clientHeight, 1);
        if (viewer.scene.mode === SceneMode.SCENE2D) {
          camera.moveRight(-dx * height);
          camera.moveUp(dy * height);
        } else {
          const scale = Math.min(2, height / 6378137);
          camera.rotateLeft(dx * scale);
          camera.rotateUp(dy * scale);
        }
        if (current.distance > 10 && previous.distance > 10) {
          const targetHeight = Math.max(500, Math.min(40000000, height * previous.distance / current.distance));
          camera.zoomIn(height - targetHeight);
        }
        const angle = Math.atan2(Math.sin(current.angle - previous.angle), Math.cos(current.angle - previous.angle));
        camera.twistRight(angle);
        viewer.scene.requestRender();
      }
      previous = current;
      return;
    }
    if (event.type === "pointerup" && !gestureUsed && start && event.timeStamp - start.time < 500) {
      const bounds = canvas.getBoundingClientRect();
      onTap(new Cartesian2(event.clientX - bounds.left, event.clientY - bounds.top));
    }
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    previous = geometry();
    if (!pointers.size) start = null;
  }

  const events = ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"];
  events.forEach((name) => canvas.addEventListener(name, handle, { capture: true, passive: false }));
  return () => {
    events.forEach((name) => canvas.removeEventListener(name, handle, true));
    for (const id of pointers.keys()) {
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
    pointers.clear();
    canvas.style.touchAction = previousTouchAction;
    delete canvas.dataset.touchNavigation;
  };
}
