import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("../frontend/", import.meta.url));
const source = fileURLToPath(new URL("../frontend/dist-oci/", import.meta.url));
const output = fileURLToPath(new URL("../oci/dist-oci/", import.meta.url));
const windows = process.platform === "win32";
const result = spawnSync(windows ? process.env.ComSpec || "cmd.exe" : "npm", windows ? ["/d", "/s", "/c", "npm.cmd run build:oci"] : ["run", "build:oci"], {
  cwd: frontend, stdio: "inherit",
});
if (result.error || result.status !== 0 || !existsSync(source)) {
  console.error("Independent OCI build did not complete.");
  process.exitCode = 1;
} else {
  rmSync(output, { recursive: true, force: true });
  cpSync(source, output, { recursive: true });
  console.log("OCI deployment output prepared separately from the public application.");
}
