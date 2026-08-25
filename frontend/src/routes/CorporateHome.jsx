import React from "react";
import Hero from "../components/corporate/Hero";
import ProblemSection from "../components/corporate/ProblemSection";
import ReactiveProactiveSection from "../components/corporate/ReactiveProactiveSection";
import ContractIntelligenceSection from "../components/corporate/ContractIntelligenceSection";
import AviationSection from "../components/corporate/AviationSection";
import ProgressionSection from "../components/corporate/ProgressionSection";
import FutureVisionSection from "../components/corporate/FutureVisionSection";
import DemoCta from "../components/corporate/DemoCta";
import AskOperionSection from "../components/corporate/AskOperionSection";
import RoleBasedSection from "../components/corporate/RoleBasedSection";
import ScenarioSection from "../components/corporate/ScenarioSection";

export default function CorporateHome() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <ReactiveProactiveSection />
      <ContractIntelligenceSection />
      <AskOperionSection />
      <RoleBasedSection />
      <AviationSection />
      <ScenarioSection />
      <ProgressionSection />
      <FutureVisionSection />
      <DemoCta />
    </>
  );
}
