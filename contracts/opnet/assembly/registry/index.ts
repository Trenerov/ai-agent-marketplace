import { Blockchain } from "@btc-vision/btc-runtime/runtime";
import { revertOnError } from "@btc-vision/btc-runtime/runtime/abort/abort";
import { AgentRegistry } from "../src/AgentRegistry";

Blockchain.contract = () => {
  return new AgentRegistry();
};

export * from "@btc-vision/btc-runtime/runtime/exports";

export function abort(message: string, fileName: string, line: u32, column: u32): void {
  revertOnError(message, fileName, line, column);
}
