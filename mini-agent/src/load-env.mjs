import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(packageRoot, ".env") });
