import { defineConfig } from "@vscode/test-cli";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  files: "out/test/**/*.test.js",
  workspaceFolder: path.join(rootDir, "test-fixtures", "test-workspace"),
});
