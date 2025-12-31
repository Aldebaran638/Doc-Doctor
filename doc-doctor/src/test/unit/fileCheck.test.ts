import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import { checkFile, parseFileContent } from "../../modules/fileCheck";
import {
  cleanupTestFile,
  createMockWorkspaceFolder,
  createTestFile,
} from "../utils/testHelpers";
import { testFiles } from "../fixtures/testFiles";

suite("FileCheck Module Tests", () => {
  let workspaceFolder: vscode.WorkspaceFolder;
  let testFilesDir: string;

  suiteSetup(() => {
    workspaceFolder = createMockWorkspaceFolder();
    testFilesDir = workspaceFolder.uri.fsPath;
  });

  suite("parseFileContent", () => {
    test("DD-UT-001 parseFileContent parses complete comment", () => {
      const result = parseFileContent(testFiles.completeComment, "test.c");
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.functions.length, 1);

      const func = result.functions[0];
      assert.strictEqual(func.functionName, "add");
      assert.strictEqual(
        func.functionSignature.includes("int add(int a, int b)"),
        true
      );
      assert.ok(func.comment.includes("@brief"));
      assert.ok(func.comment.includes("@param"));
      assert.ok(func.comment.includes("@return"));
    });

    test("DD-UT-002 parseFileContent parses multiple functions", () => {
      const result = parseFileContent(testFiles.multipleFunctions, "test.c");
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.functions.length, 3);
      assert.strictEqual(result.functions[0].functionName, "add");
      assert.strictEqual(result.functions[1].functionName, "subtract");
      assert.strictEqual(result.functions[2].functionName, "multiply");
    });

    test("DD-UT-003 parseFileContent filters control statements", () => {
      const result = parseFileContent(testFiles.controlStatements, "test.c");
      assert.strictEqual(result.success, true);

      const functionNames = result.functions.map((f) => f.functionName);
      assert.strictEqual(functionNames.includes("if"), false);
      assert.strictEqual(functionNames.includes("for"), false);
      assert.strictEqual(functionNames.includes("while"), false);
      assert.strictEqual(functionNames.includes("switch"), false);
      assert.strictEqual(functionNames.includes("test"), true);
    });

    test("DD-UT-004 parseFileContent extracts comment block", () => {
      const result = parseFileContent(testFiles.completeComment, "test.c");
      assert.strictEqual(result.success, true);

      const func = result.functions[0];
      assert.ok(func.comment.includes("/**"));
      assert.ok(func.comment.includes("*/"));
      assert.ok(func.comment.includes("@brief"));
    });

    test("DD-UT-005 parseFileContent computes line/column", () => {
      const content = `
// some comments
// more comments

/**
 * @brief test
 */
int test() {
    return 0;
}
`;

      const result = parseFileContent(content, "test.c");
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.functions.length, 1);
      assert.ok(result.functions[0].lineNumber > 0);
      assert.ok(result.functions[0].columnNumber > 0);
    });

    test("DD-REG-001 parseFileContent rejects unsupported type", () => {
      const result = parseFileContent(testFiles.completeComment, "test.txt");
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCode, "UNSUPPORTED_FILE_TYPE");
    });

    test("DD-REG-002 parseFileContent handles empty file", () => {
      const result = parseFileContent(testFiles.emptyFile, "test.c");
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.functions.length, 0);
    });

    test("DD-REG-003 parseFileContent handles comment-only file", () => {
      const result = parseFileContent(testFiles.onlyComments, "test.c");
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.functions.length, 0);
    });
  });

  suite("checkFile", () => {
    let testFileUri: vscode.Uri | undefined;

    test("DD-FT-001 checkFile reads and parses file", async () => {
      testFileUri = await createTestFile(
        "test_complete.c",
        testFiles.completeComment,
        workspaceFolder
      );
      const result = await checkFile(testFileUri);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.functions.length, 1);
      assert.strictEqual(result.functions[0].functionName, "add");
    });

    test("DD-REG-004 checkFile handles read error", async () => {
      const nonExistentUri = vscode.Uri.file(
        path.join(testFilesDir, "non_existent.c")
      );
      const result = await checkFile(nonExistentUri);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCode, "READ_ERROR");
    });

    test("DD-REG-005 checkFile rejects unsupported type", async () => {
      testFileUri = await createTestFile(
        "test.txt",
        "some content",
        workspaceFolder
      );
      const result = await checkFile(testFileUri);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCode, "UNSUPPORTED_FILE_TYPE");
    });

    test("DD-FT-002 checkFile parses .cpp file", async () => {
      const cppContent = `
/**
 * @brief C++ function
 */
int add(int a, int b) {
    return a + b;
}
`;
      testFileUri = await createTestFile("test.cpp", cppContent, workspaceFolder);
      const result = await checkFile(testFileUri);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.functions.length, 1);
    });

    suiteTeardown(() => {
      if (testFileUri) {
        cleanupTestFile(testFileUri);
      }
    });
  });
});
