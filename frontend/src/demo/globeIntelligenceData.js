import { aircraftRouteHeading, aircraftRoutePosition } from "../components/aviation/aircraftPose.js";
import { createDemonstrationScenarios } from "../../../shared/globeScenarioData.js";

export { GLOBE_DEMO_NOTICE, SCENARIO_DATE, answerFlightQuestion, GLOBAL_AIRPORTS, EUROPEAN_AIRPORTS } from "../../../shared/globeScenarioData.js";

export function createDemonstrationAircraft() {
  return createDemonstrationScenarios().map((flight) => {
    const origin = [flight.route.origin.longitude, flight.route.origin.latitude];
    const destination = [flight.route.destination.longitude, flight.route.destination.latitude];
    return {
      ...flight,
      ...aircraftRoutePosition(origin, destination, flight.routeProgress),
      heading: aircraftRouteHeading(origin, destination, flight.routeProgress),
    };
  });
}
