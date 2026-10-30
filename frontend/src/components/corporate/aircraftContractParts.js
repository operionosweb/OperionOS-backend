export const AIRCRAFT_CONTRACT_PARTS = [
  {
    id: "airframe", label: "Airframe & cabin", anchor: [0.42, 0.3, 1.15],
    contracts: "Aircraft operating or finance lease · hull insurance · cabin refurbishment",
    context: "The fuselage and cabin sit within the leased asset definition. Cabin configuration and approved modifications can affect delivery and redelivery obligations.",
    checks: ["Asset identity, permitted use and modification consent", "Return condition, damage responsibility and insurance scope", "Technical records, configuration and refurbishment obligations"],
  },
  {
    id: "engines", label: "Engines", anchor: [1.32, -0.3, 0.88],
    contracts: "Engine lease · power-by-the-hour (PBH) · engine maintenance agreement",
    context: "Engines may be separately leased and covered by maintenance programmes priced by flight hour or cycle. A shop visit can connect technical condition to commercial exposure.",
    checks: ["Engine serial numbers, permitted substitution and return conditions", "Hourly or cycle rates, minimum utilisation and escalation", "Life-limited parts, shop-visit scope and maintenance reserves"],
  },
  {
    id: "wings", label: "Wings & fuel systems", anchor: [2.65, 0.25, -0.85],
    contracts: "Airframe MRO · fuel supply · component support",
    context: "Wing structures, control surfaces and fuel systems depend on airframe and component maintenance. Fuel procurement governs the consumable, rather than ownership of the wing.",
    checks: ["Inspection intervals, repairs and airworthiness responsibilities", "Fuel quality, delivery location and price-adjustment terms", "Component availability, turnaround commitments and exclusions"],
  },
  {
    id: "tail", label: "Tail & control surfaces", anchor: [0, 1.45, -3.4],
    contracts: "Airframe maintenance · flight-control component support · aircraft lease",
    context: "The empennage and control surfaces are part of the airframe. Inspection, damage repairs and component replacements may engage several agreements.",
    checks: ["Structural inspections, approved repairs and release documentation", "Flight-control component warranties and support scope", "Redelivery condition and modification or livery removal"],
  },
  {
    id: "avionics", label: "Cockpit & avionics", anchor: [0.16, 0.32, 2.98],
    contracts: "Avionics support · software or navigation-data licence · equipment lease",
    context: "Cockpit systems combine physical equipment with software and data subscriptions. Ownership, update rights and support obligations are not necessarily in the same agreement.",
    checks: ["Equipment configuration, licensing and transfer rights", "Navigation-data currency, updates and subscription coverage", "Repair turnaround, obsolescence, warranty and service exclusions"],
  },
];

export function aircraftPartId(object) {
  for (let current = object; current; current = current.parent) {
    if (current.userData?.contractPart) return current.userData.contractPart;
  }
  return null;
}
