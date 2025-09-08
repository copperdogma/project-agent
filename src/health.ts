import fs from "fs";
import path from "path";
import { getVaultRoot } from "./vault.js";

export function checkVaultWritable(): boolean {
  try {
    const root = getVaultRoot();
    const dir = path.join(root, ".project-agent");
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, ".write-test.tmp");
    fs.writeFileSync(p, String(Date.now()));
    fs.unlinkSync(p);
    return true;
  } catch {
    return false;
  }
}

