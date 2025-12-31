import * as assert from "assert";
import * as vscode from "vscode";
import { checkAllFiles } from "../../modules/projectCheck";
import { cleanupTestFile, createMockWorkspaceFolder, createTestFile } from "../utils/testHelpers";
import { testFiles } from "../fixtures/testFiles";

suite("ProjectCheck Integration Tests", () => {
  let workspaceFolder: vscode.WorkspaceFolder;
  const testFilesList: vscode.Uri[] = [];
  let originalWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
  let workspaceResetNeeded = false;

  suiteSetup(async () => {
    workspaceFolder = createMockWorkspaceFolder();
    testFilesList.push(
      await createTestFile("file1.c", testFiles.completeComment, workspaceFolder),
      await createTestFile("file2.c", testFiles.missingBrief, workspaceFolder),
      await createTestFile("file3.c", testFiles.missingParam, workspaceFolder),
      await createTestFile("file4.c", testFiles.noComment, workspaceFolder)
    );

    originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    const currentCount = originalWorkspaceFolders?.length ?? 0;
    const needsUpdate =
      currentCount !== 1 ||
      originalWorkspaceFolders?.[0]?.uri.fsPath !== workspaceFolder.uri.fsPath;

    if (needsUpdate) {
      workspaceResetNeeded = true;
      vscode.workspace.updateWorkspaceFolders(0, currentCount, {
        uri: workspaceFolder.uri,
        name: workspaceFolder.name,
      });
    }
  });

  suiteTeardown(() => {
    testFilesList.forEach((uri) => cleanupTestFile(uri));

    if (workspaceResetNeeded) {
      const currentCount = vscode.workspace.workspaceFolders?.length ?? 0;
      const restoreInputs =
        originalWorkspaceFolders?.map((folder) => ({
          uri: folder.uri,
          name: folder.name,
        })) ?? [];
      vscode.workspace.updateWorkspaceFolders(0, currentCount, ...restoreInputs);
    }
  });

  test("DD-SMK-002 checkAllFiles returns success", async () => {
    const result = await checkAllFiles();
    assert.strictEqual(result.success, true);
    assert.ok(result.totalFiles > 0);
    assert.ok(result.checkedFiles > 0);
  });

  test("DD-IT-001 checkAllFiles detects comment issues", async () => {
    const result = await checkAllFiles();
    assert.strictEqual(result.success, true);
    assert.ok(result.problems.length > 0);
  });

  test("DD-IT-002 checkAllFiles reports file counts", async () => {
    const result = await checkAllFiles();
    assert.ok(result.totalFiles >= testFilesList.length);
    assert.ok(result.checkedFiles <= result.totalFiles);
  });

  test("DD-IT-003 checkAllFiles respects cancellation", async () => {
    const cancellationToken = new vscode.CancellationTokenSource();
    cancellationToken.cancel();
    const result = await checkAllFiles(undefined, cancellationToken.token);
    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage?.includes("取消"));
  });

  test("DD-IT-004 checkAllFiles skips syntax error files", async () => {
    const syntaxErrorFile = await createTestFile(
      "syntax_error.c",
      testFiles.syntaxError,
      workspaceFolder
    );
    testFilesList.push(syntaxErrorFile);
    const result = await checkAllFiles();
    assert.strictEqual(result.success, true);
    const syntaxProblems = result.problems.filter((p) => p.problemType === 5);
    if (syntaxProblems.length > 0) {
      const skipped = result.skippedFiles.find((f) =>
        f.includes("syntax_error.c")
      );
      assert.ok(skipped);
    }
  });
});
