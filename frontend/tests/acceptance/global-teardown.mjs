import { assertAcceptanceExecutionAllowed } from "./safety.mjs";

export default async function globalTeardown() {
  assertAcceptanceExecutionAllowed();
}