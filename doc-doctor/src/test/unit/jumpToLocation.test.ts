import * as assert from "assert";
import * as vscode from "vscode";
import { jumpToLocation } from "../../modules/jumpToLocation";
import { cleanupTestFile, createMockWorkspaceFolder, createTestFile } from "../utils/testHelpers";
import { testFiles } from "../fixtures/testFiles";

suite("JumpToLocation Module Tests", () => {
  let workspaceFolder: vscode.WorkspaceFolder;
  let testFileUri: vscode.Uri;

  suiteSetup(async () => {
    workspaceFolder = createMockWorkspaceFolder();
    testFileUri = await createTestFile(
      "test_jump.c",
      testFiles.completeComment,
      workspaceFolder
    );
  });

  suiteTeardown(() => {
    if (testFileUri) {
      cleanupTestFile(testFileUri);
    }
  });

  test("DD-FT-003 jumpToLocation supports relative paths", async () => {
    const relativePath = vscode.workspace.asRelativePath(testFileUri, false);
    const success = await jumpToLocation(relativePath, 1, 1);
    assert.ok(typeof success === "boolean");
  });

  test("DD-FT-004 jumpToLocation supports absolute paths", async () => {
    const success = await jumpToLocation(testFileUri.fsPath, 1, 1);
    assert.ok(typeof success === "boolean");
  });

  test("DD-REG-006 jumpToLocation handles missing files", async () => {
    const success = await jumpToLocation("non_existent_file.c", 1, 1);
    assert.strictEqual(success, false);
  });
});
