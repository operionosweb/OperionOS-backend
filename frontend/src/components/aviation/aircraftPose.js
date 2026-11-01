import Cartesian3 from "@cesium/engine/Source/Core/Cartesian3.js";
import EllipsoidGeodesic from "@cesium/engine/Source/Core/EllipsoidGeodesic.js";
import Cartographic from "@cesium/engine/Source/Core/Cartographic.js";
import HeadingPitchRoll from "@cesium/engine/Source/Core/HeadingPitchRoll.js";
import Transforms from "@cesium/engine/Source/Core/Transforms.js";

export const AIRCRAFT_MODEL_URL = "/models/operion-airliner.glb";
export const AIRCRAFT_STATUS_COLORS = Object.freeze({
  "On time": "#4cd18c", Delayed: "#efad43", Diverted: "#ee5a64",
  "Weather impact": "#9b7aef", Maintenance: "#58b6dc",
  Cancelled: "#ee5a64", Rerouted: "#e19c3a",
});

export function aircraftOrientation(position, heading) {
  // Cesium corrects glTF +Z forward / +Y up to local +X forward / +Z up.
  // True bearings start north, not east; keep roll/pitch level in ENU.
  return Transforms.headingPitchRollQuaternion(position, new HeadingPitchRoll((heading - 90) * Math.PI / 180, 0, 0));
}

export function aircraftRoutePositions(origin, current, destination) {
  const positions = [];
  for (const [start, end] of [[origin, current], [current, destination]]) {
    const geodesic = new EllipsoidGeodesic(
      Cartographic.fromDegrees(start[0], start[1]), Cartographic.fromDegrees(end[0], end[1]),
    );
    for (let index = positions.length ? 1 : 0; index <= 32; index++) {
      const point = geodesic.interpolateUsingFraction(index / 32);
      positions.push(Cartesian3.fromRadians(point.longitude, point.latitude, 16000));
    }
  }
  return positions;
}

export function advanceAircraftPosition(position, heading, distanceMeters) {
  const longitude = position.longitude * Math.PI / 180;
  const latitude = position.latitude * Math.PI / 180;
  const bearing = heading * Math.PI / 180;
  const arc = distanceMeters / 6371008.8;
  const nextLatitude = Math.asin(Math.sin(latitude) * Math.cos(arc) + Math.cos(latitude) * Math.sin(arc) * Math.cos(bearing));
  const nextLongitude = longitude + Math.atan2(Math.sin(bearing) * Math.sin(arc) * Math.cos(latitude), Math.cos(arc) - Math.sin(latitude) * Math.sin(nextLatitude));
  return { longitude: ((nextLongitude * 180 / Math.PI + 540) % 360) - 180, latitude: nextLatitude * 180 / Math.PI };
}
