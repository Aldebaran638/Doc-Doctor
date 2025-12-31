import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * Create a mock workspace folder for tests.
 */
export function createMockWorkspaceFolder(
  name: string = "test-workspace"
): vscode.WorkspaceFolder {
  const uri = vscode.Uri.file(
    path.join(__dirname, "../../../test-fixtures", name)
  );
  return {
    uri,
    name,
    index: 0,
  };
}

/**
 * Create a temporary test file in the mock workspace.
 */
export async function createTestFile(
  fileName: string,
  content: string,
  workspaceFolder?: vscode.WorkspaceFolder
): Promise<vscode.Uri> {
  const folder = workspaceFolder ?? createMockWorkspaceFolder();
  const filePath = path.join(folder.uri.fsPath, fileName);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, "utf8");
  return vscode.Uri.file(filePath);
}

/**
 * Remove a test file if it exists.
 */
export function cleanupTestFile(uri: vscode.Uri): void {
  try {
    if (fs.existsSync(uri.fsPath)) {
      fs.unlinkSync(uri.fsPath);
    }
  } catch {
    // Ignore cleanup errors.
  }
}

/**
 * Create a mock VS Code configuration object.
 */
export function createMockConfiguration(
  config: Record<string, unknown> = {}
): vscode.WorkspaceConfiguration {
  const defaultConfig = {
    "doc-doctor.checkMainFunction": false,
    "doc-doctor.fileWhitelist": [],
    "doc-doctor.functionWhitelist": {},
    "doc-doctor.returnTypeWhitelist": [],
    "doc-doctor.enableGitChangeWarning": true,
    "doc-doctor.enableAIRefactor": false,
    "doc-doctor.ai.endpoint": "",
    "doc-doctor.ai.apiKey": "",
    ...config,
  };

  return {
    get: <T>(key: string, defaultValue?: T): T => {
      const keys = key.split(".");
      let value: any = defaultConfig;
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) {
          return defaultValue as T;
        }
      }
      return (value ?? defaultValue) as T;
    },
    has: (key: string): boolean => {
      const keys = key.split(".");
      let value: any = defaultConfig;
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) {
          return false;
        }
      }
      return true;
    },
    inspect: () => undefined,
    update: async () => {},
  };
}

/**
 * Sleep helper for async tests.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
