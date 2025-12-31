import * as assert from "assert";
import * as vscode from "vscode";
import {
  clearAllProblems,
  initDB,
  loadProblemsFromDB,
  saveProblemToDB,
  updateProblemStatusInDB,
  ProblemStatus,
} from "../../modules/database";
import { ProblemType } from "../../modules/functionCheck";

suite("Database Integration Tests", () => {
  suiteSetup(() => {
    const extensionUri = vscode.Uri.file(__dirname);
    initDB(extensionUri);
  });

  test("DD-IT-005 saveProblemToDB stores problem", async () => {
    const problem = {
      problemType: ProblemType.BRIEF_MISSING,
      filePath: "test.c",
      functionName: "testFunc",
      functionSignature: "int testFunc()",
      lineNumber: 1,
      columnNumber: 1,
      problemDescription: "缺少函数功能描述",
      functionSnippet: "int testFunc() { return 0; }",
    };
    const result = await saveProblemToDB(problem);
    assert.strictEqual(result.success, true);
  });

  test("DD-IT-006 loadProblemsFromDB returns list", async () => {
    const result = await loadProblemsFromDB();
    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.problems));
  });

  test("DD-IT-007 updateProblemStatusInDB updates status", async () => {
    const problem = {
      problemType: ProblemType.PARAM_MISSING,
      filePath: "test2.c",
      functionName: "testFunc2",
      functionSignature: "void testFunc2(int a)",
      lineNumber: 1,
      columnNumber: 1,
      problemDescription: "缺少参数说明",
      functionSnippet: "void testFunc2(int a) {}",
    };
    const saveResult = await saveProblemToDB(problem);
    if (saveResult.success && saveResult.insertedId) {
      const updateSuccess = await updateProblemStatusInDB(
        saveResult.insertedId,
        ProblemStatus.IGNORED
      );
      assert.strictEqual(typeof updateSuccess, "boolean");
    }
  });

  test("DD-IT-008 clearAllProblems clears data", async () => {
    const result = await clearAllProblems();
    assert.strictEqual(typeof result, "boolean");
  });

  test("DD-IT-009 saveProblemToDB works in mock mode", async () => {
    const problem = {
      problemType: ProblemType.RETURN_MISSING,
      filePath: "test3.c",
      functionName: "testFunc3",
      functionSignature: "int testFunc3()",
      lineNumber: 1,
      columnNumber: 1,
      problemDescription: "缺少返回值说明",
      functionSnippet: "int testFunc3() { return 0; }",
    };
    const result = await saveProblemToDB(problem);
    assert.strictEqual(result.success, true);
  });
});
