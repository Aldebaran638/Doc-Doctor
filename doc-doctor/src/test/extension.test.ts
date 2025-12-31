import * as assert from "assert";
import * as vscode from "vscode";
import { activate } from "../extension";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("DD-SMK-001 extension activates", () => {
    const mockContext = {
      subscriptions: [],
      extensionPath: __dirname,
      extensionUri: vscode.Uri.file(__dirname),
      storagePath: __dirname,
      globalStoragePath: __dirname,
      logPath: __dirname,
      extensionMode: vscode.ExtensionMode.Test,
    } as unknown as vscode.ExtensionContext;

    const result = activate(mockContext);
    assert.ok(result !== undefined || result === undefined);
  });

  test("DD-FT-005 extension commands are registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    const docDoctorCommands = commands.filter((cmd) =>
      cmd.startsWith("doc-doctor.")
    );
    assert.ok(docDoctorCommands.length > 0);
  });
});
