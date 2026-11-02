import React, { createContext, useContext } from "react";
import { DEMO_CONTRACTS } from "../../../shared/mattDemoContracts.js";

export { DEMO_CONTRACTS };
const primaryContract = DEMO_CONTRACTS[0];
const DemoDataContext = createContext(null);

export function DemoDataProvider({ children }) {
  const value = {
    mode: "synthetic",
    sourceLabel: "DEMO DATA",
    contracts: DEMO_CONTRACTS,
    primaryContract,
    budget: { allocated: 5000, used: 1245, remaining: 3755, synthetic: true },
    getContract: (id) => DEMO_CONTRACTS.find((contract) => contract.id === id) || primaryContract,
    getEvidence: (id) => primaryContract.evidence.find((item) => item.id === id),
  };
  return <DemoDataContext.Provider value={value}>{children}</DemoDataContext.Provider>;
}

export function useDemoData() {
  const context = useContext(DemoDataContext);
  if (!context) throw new Error("useDemoData must be used within DemoDataProvider");
  return context;
}
