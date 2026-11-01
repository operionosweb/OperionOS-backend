import React from "react";
import { MattExperience } from "../../routes/Matt";
import { useDemoData } from "../../demo/DemoDataProvider";

export default function AskOperionWorkspace() {
  const { primaryContract } = useDemoData();
  return <MattExperience demo contract={primaryContract}/>;
}
