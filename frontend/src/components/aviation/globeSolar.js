import ClockStep from "@cesium/engine/Source/Core/ClockStep.js";
import JulianDate from "@cesium/engine/Source/Core/JulianDate.js";

const radians = (degrees) => degrees * Math.PI / 180;
const degrees = (value) => value * 180 / Math.PI;
const wrapDegrees = (value) => ((value + 180) % 360 + 360) % 360 - 180;

export function solarSubpointAtUtc(instant) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new TypeError("A valid UTC date is required.");

  const julianDay = date.getTime() / 86400000 + 2440587.5;
  const century = (julianDay - 2451545) / 36525;
  const meanLongitude = (280.46646 + century * (36000.76983 + century * 0.0003032)) % 360;
  const meanAnomaly = radians(357.52911 + century * (35999.05029 - 0.0001537 * century));
  const eccentricity = 0.016708634 - century * (0.000042037 + 0.0000001267 * century);
  const equationOfCenter = Math.sin(meanAnomaly) * (1.914602 - century * (0.004817 + 0.000014 * century))
    + Math.sin(2 * meanAnomaly) * (0.019993 - 0.000101 * century)
    + Math.sin(3 * meanAnomaly) * 0.000289;
  const trueLongitude = meanLongitude + equationOfCenter;
  const omega = radians(125.04 - 1934.136 * century);
  const apparentLongitude = radians(trueLongitude - 0.00569 - 0.00478 * Math.sin(omega));
  const meanObliquity = 23 + (26 + (21.448 - century * (46.815 + century * (0.00059 - century * 0.001813))) / 60) / 60;
  const obliquity = radians(meanObliquity + 0.00256 * Math.cos(omega));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude));

  const y = Math.tan(obliquity / 2) ** 2;
  const equationOfTime = 4 * degrees(
    y * Math.sin(2 * radians(meanLongitude))
      - 2 * eccentricity * Math.sin(meanAnomaly)
      + 4 * eccentricity * y * Math.sin(meanAnomaly) * Math.cos(2 * radians(meanLongitude))
      - 0.5 * y ** 2 * Math.sin(4 * radians(meanLongitude))
      - 1.25 * eccentricity ** 2 * Math.sin(2 * meanAnomaly),
  );
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const longitude = wrapDegrees((720 - utcMinutes - equationOfTime) / 4);
  return { longitude, latitude: degrees(declination) };
}

export function synchronizeGlobeSolarTime(viewer, instant = new Date()) {
  if (!viewer || viewer.isDestroyed?.()) return false;
  if (viewer.scene?.globe) {
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.globe.dynamicAtmosphereLighting = false;
    viewer.scene.globe.dynamicAtmosphereLightingFromSun = false;
  }
  if (viewer.clock) {
    viewer.clock.currentTime = JulianDate.fromDate(instant instanceof Date ? instant : new Date(instant));
    viewer.clock.clockStep = ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    viewer.clock.multiplier = 1;
    viewer.clock.shouldAnimate = false;
  }
  viewer.scene?.requestRender?.();
  return true;
}
