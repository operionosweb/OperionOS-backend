// actionEngine.js

export function generateActions(fleetData) {

  const actions = [];

  fleetData.forEach((ac) => {

    const failure = ac.failure || 0;

    if (failure > 75) {
      actions.push({
        type: "IMMEDIATE_MAINTENANCE",
        priority: "CRITICAL",
        aircraftId: ac.id,
        tail: ac.tail,
        message: "Immediate inspection required",
        due: "NOW"
      });
    }

    else if (failure > 50) {
      actions.push({
        type: "SCHEDULE_MAINTENANCE",
        priority: "HIGH",
        aircraftId: ac.id,
        tail: ac.tail,
        message: "Schedule maintenance within 7 days",
        due: "7_DAYS"
      });
    }

    else if (failure > 30) {
      actions.push({
        type: "MONITOR",
        priority: "MEDIUM",
        aircraftId: ac.id,
        tail: ac.tail,
        message: "Monitor system trends",
        due: "ONGOING"
      });
    }

  });

  return actions;
}
