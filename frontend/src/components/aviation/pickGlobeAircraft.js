import Cartesian3 from "@cesium/engine/Source/Core/Cartesian3.js";
import EllipsoidalOccluder from "@cesium/engine/Source/Core/EllipsoidalOccluder.js";
import SceneMode from "@cesium/engine/Source/Scene/SceneMode.js";

// Aircraft screen-space hit targets avoid a blocking GPU pick/readPixels pass.
export function pickGlobeAircraft(viewer, position) {
  const { scene, camera, canvas } = viewer;
  if (scene.mode === SceneMode.MORPHING) return undefined;
  const occluder = scene.mode === SceneMode.SCENE3D
    ? new EllipsoidalOccluder(scene.globe.ellipsoid, camera.positionWC) : null;
  const models = new Map();
  for (let index = 0; index < scene.primitives.length; index++) {
    const primitive = scene.primitives.get(index);
    if (primitive.ready && primitive.id?.id?.startsWith("aircraft-")) models.set(primitive.id.id, primitive);
  }
  let closest;
  let closestDistance = Infinity;
  for (const entity of viewer.entities.values) {
    if (!entity.id.startsWith("aircraft-") || !entity.isShowing) continue;
    const world = entity.position?.getValue(viewer.clock.currentTime);
    if (!world || (occluder && !occluder.isPointVisible(world))) continue;
    const screen = scene.cartesianToCanvasCoordinates(world);
    if (!screen) continue;
    const model = models.get(entity.id);
    if (entity.model && !model) continue;
    const size = entity.model?.minimumPixelSize?.getValue(viewer.clock.currentTime)
      || entity.point?.pixelSize?.getValue(viewer.clock.currentTime) || 0;
    let radius = size / 2 + 4;
    if (model) {
      const sphere = model.boundingSphere;
      const pixelSize = camera.getPixelSize(sphere, scene.drawingBufferWidth, scene.drawingBufferHeight);
      if (pixelSize > 0) radius = Math.max(radius, sphere.radius / pixelSize * canvas.clientWidth / scene.drawingBufferWidth);
    }
    if (Math.hypot(position.x - screen.x, position.y - screen.y) > radius) continue;
    const distance = Cartesian3.distanceSquared(camera.positionWC, world);
    if (distance < closestDistance) {
      closest = entity.id.slice("aircraft-".length);
      closestDistance = distance;
    }
  }
  return closest;
}
