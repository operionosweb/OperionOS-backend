import Cartesian2 from "@cesium/engine/Source/Core/Cartesian2.js";
import SceneMode from "@cesium/engine/Source/Scene/SceneMode.js";

// Capture touch before Cesium's recognizer; leave mouse navigation untouched.
export function attachGlobeTouchControls(viewer, onTap) {
  const canvas = viewer.canvas;
  const pointers = new Map();
  const previousTouchAction = canvas.style.touchAction;
  let previous = null;
  let start = null;
  let gestureUsed = false;
  canvas.style.touchAction = "none";
  canvas.dataset.touchNavigation = "drag-pinch";

  function geometry() {
    const [first, second] = [...pointers.values()];
    if (pointers.size === 1) return first;
    if (pointers.size !== 2) return null;
    return { distance: Math.hypot(second.x - first.x, second.y - first.y) };
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
      viewer.camera.cancelFlight();
      if (pointers.size >= 2) gestureUsed = true;
      previous = geometry();
      return;
    }
    if (!pointers.has(event.pointerId)) return;
    if (event.type === "pointermove") {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) gestureUsed = true;
      const current = geometry();
      if (current && previous && gestureUsed && viewer.scene.mode !== SceneMode.MORPHING) {
        const camera = viewer.camera;
        const height = Math.max(500, camera.positionCartographic.height);
        if (pointers.size === 1) {
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
        } else if (current.distance > 10 && previous.distance > 10) {
          const ratio = Math.max(.8, Math.min(1.25, previous.distance / current.distance));
          const targetHeight = Math.max(500, Math.min(40000000, height * ratio));
          camera.zoomIn(height - targetHeight);
        }
        viewer.scene.requestRender();
      }
      previous = current;
      return;
    }
    if (event.type === "pointerup" && !gestureUsed && start && event.timeStamp - start.time < 500 && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 8 && viewer.scene.mode !== SceneMode.MORPHING) {
      const bounds = canvas.getBoundingClientRect();
      onTap(new Cartesian2(event.clientX - bounds.left, event.clientY - bounds.top));
    }
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    previous = geometry();
    if (!pointers.size) { start = null; previous = null; }
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
