import React from "react";
import Hero from "../components/corporate/Hero";
import ProblemSection from "../components/corporate/ProblemSection";
import ContractIntelligenceSection from "../components/corporate/ContractIntelligenceSection";
import AviationSection from "../components/corporate/AviationSection";
import ProgressionSection from "../components/corporate/ProgressionSection";
import FutureVisionSection from "../components/corporate/FutureVisionSection";
import DemoCta from "../components/corporate/DemoCta";

export default function CorporateHome() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <ContractIntelligenceSection />
      <AviationSection />
      <ProgressionSection />
      <FutureVisionSection />
      <DemoCta />
    </>
  );
}
