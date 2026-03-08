import "server-only";

import path from "node:path";

const OPNET_WORKDIR = path.join(process.cwd(), "contracts", "opnet");
const OPNET_SCRIPT_PREFIX = "contracts/opnet/scripts";

export function getOpnetWorkdir() {
  return OPNET_WORKDIR;
}

export function getOpnetScriptPath(scriptName: string) {
  return `${OPNET_SCRIPT_PREFIX}/${scriptName}`;
}
