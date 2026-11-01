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
  const segments = destination ? [[origin, current], [current, destination]] : [[origin, current]];
  for (const [start, end] of segments) {
    const geodesic = routeGeodesic(start, end);
    for (let index = positions.length ? 1 : 0; index <= 64; index++) {
      const point = geodesic.interpolateUsingFraction(index / 64);
      positions.push(Cartesian3.fromRadians(point.longitude, point.latitude, 16000));
    }
  }
  return positions;
}

function routeGeodesic(origin, destination) {
  return new EllipsoidGeodesic(
    Cartographic.fromDegrees(origin[0], origin[1]),
    Cartographic.fromDegrees(destination[0], destination[1]),
  );
}

function routePoint(origin, destination, fraction) {
  const point = routeGeodesic(origin, destination).interpolateUsingFraction(Math.max(0, Math.min(1, fraction)));
  return {
    longitude: ((point.longitude * 180 / Math.PI + 540) % 360) - 180,
    latitude: point.latitude * 180 / Math.PI,
  };
}

function initialBearing(from, to) {
  const longitudeDelta = ((to.longitude - from.longitude + 540) % 360 - 180) * Math.PI / 180;
  const latitude1 = from.latitude * Math.PI / 180;
  const latitude2 = to.latitude * Math.PI / 180;
  return (Math.atan2(
    Math.sin(longitudeDelta) * Math.cos(latitude2),
    Math.cos(latitude1) * Math.sin(latitude2) - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta),
  ) * 180 / Math.PI + 360) % 360;
}

export function aircraftRoutePosition(origin, destination, fraction) {
  return routePoint(origin, destination, fraction);
}

export function aircraftRouteHeading(origin, destination, fraction) {
  const step = 0.0001;
  const fromFraction = fraction >= 1 ? Math.max(0, fraction - step) : fraction;
  const toFraction = fraction >= 1 ? fraction : Math.min(1, fraction + step);
  return initialBearing(routePoint(origin, destination, fromFraction), routePoint(origin, destination, toFraction));
}

export function aircraftRouteDistance(origin, destination) {
  return routeGeodesic(origin, destination).surfaceDistance;
}

export function advanceAircraftAlongRoute(origin, destination, fraction, distanceMeters) {
  const distance = aircraftRouteDistance(origin, destination);
  const nextFraction = distance > 0 ? Math.min(1, fraction + Math.max(0, distanceMeters) / distance) : 1;
  const position = routePoint(origin, destination, nextFraction);
  return {
    ...position,
    fraction: nextFraction,
    heading: aircraftRouteHeading(origin, destination, nextFraction),
    arrived: nextFraction >= 1,
  };
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
