import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Server dir:", __dirname);
console.log("Client dist path:", path.join(__dirname, "../client/dist"));
console.log(
  "Index.html path:",
  path.join(__dirname, "../client/dist/index.html")
);
console.log(
  "Index.html exists:",
  fs.existsSync(path.join(__dirname, "../client/dist/index.html"))
);
