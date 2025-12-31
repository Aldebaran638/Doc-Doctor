import * as assert from "assert";
import { checkFunction, ProblemType } from "../../modules/functionCheck";
import { parseFileContent } from "../../modules/fileCheck";
import { testFiles } from "../fixtures/testFiles";

suite("FunctionCheck Module Tests", () => {
  suite("checkFunction", () => {
    test("DD-UT-006 checkFunction detects missing @brief", () => {
      const result = parseFileContent(testFiles.missingBrief, "test.c");
      assert.strictEqual(result.success, true);
      const problems = checkFunction(result.functions[0]);
      const briefProblems = problems.filter(
        (p) => p.problemType === ProblemType.BRIEF_MISSING
      );
      assert.strictEqual(briefProblems.length, 1);
    });

    test("DD-UT-007 checkFunction detects missing @param", () => {
      const result = parseFileContent(testFiles.missingParam, "test.c");
      assert.strictEqual(result.success, true);
      const problems = checkFunction(result.functions[0]);
      const paramProblems = problems.filter(
        (p) => p.problemType === ProblemType.PARAM_MISSING
      );
      assert.strictEqual(paramProblems.length, 2);
    });

    test("DD-UT-008 checkFunction detects missing @return", () => {
      const result = parseFileContent(testFiles.missingReturn, "test.c");
      assert.strictEqual(result.success, true);
      const problems = checkFunction(result.functions[0]);
      const returnProblems = problems.filter(
        (p) => p.problemType === ProblemType.RETURN_MISSING
      );
      assert.strictEqual(returnProblems.length, 1);
    });

    test("DD-UT-009 void functions do not require @return", () => {
      const result = parseFileContent(testFiles.voidFunction, "test.c");
      assert.strictEqual(result.success, true);
      const problems = checkFunction(result.functions[0]);
      const returnProblems = problems.filter(
        (p) => p.problemType === ProblemType.RETURN_MISSING
      );
      assert.strictEqual(returnProblems.length, 0);
    });

    test("DD-UT-010 complete comments yield no problems", () => {
      const result = parseFileContent(testFiles.completeComment, "test.c");
      assert.strictEqual(result.success, true);
      const problems = checkFunction(result.functions[0]);
      assert.strictEqual(problems.length, 0);
    });

    test("DD-UT-011 no comment yields multiple problems", () => {
      const result = parseFileContent(testFiles.noComment, "test.c");
      assert.strictEqual(result.success, true);
      const problems = checkFunction(result.functions[0]);
      assert.ok(problems.length >= 3);
      const problemTypes = problems.map((p) => p.problemType);
      assert.ok(problemTypes.includes(ProblemType.BRIEF_MISSING));
      assert.ok(problemTypes.includes(ProblemType.PARAM_MISSING));
      assert.ok(problemTypes.includes(ProblemType.RETURN_MISSING));
    });

    test("DD-UT-012 pointer params are recognized", () => {
      const result = parseFileContent(testFiles.pointerParams, "test.c");
      assert.strictEqual(result.success, true);
      const func = result.functions[0];
      const problems = checkFunction(func);
      const paramProblems = problems.filter(
        (p) => p.problemType === ProblemType.PARAM_MISSING
      );
      assert.strictEqual(paramProblems.length, 0);
    });

    test("DD-UT-013 problem description contains param info", () => {
      const result = parseFileContent(testFiles.missingParam, "test.c");
      assert.strictEqual(result.success, true);
      const problems = checkFunction(result.functions[0]);
      const paramProblem = problems.find(
        (p) => p.problemType === ProblemType.PARAM_MISSING
      );
      assert.ok(paramProblem);
      assert.ok(paramProblem.problemDescription.includes("@param"));
      assert.ok(
        paramProblem.problemDescription.includes("a") ||
          paramProblem.problemDescription.includes("b")
      );
    });
  });
});
