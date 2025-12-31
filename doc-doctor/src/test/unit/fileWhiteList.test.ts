import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import {
  DocDoctorSettings,
  getDocDoctorSettings,
  isFileWhitelisted,
  isFunctionWhitelisted,
  isReturnTypeWhitelisted,
  shouldSkipFunction,
} from "../../modules/fileWhiteList";

suite("FileWhiteList Module Tests", () => {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";

  const buildPath = (...parts: string[]): string => {
    if (!workspaceRoot) {
      return parts.join("/");
    }
    return path.join(workspaceRoot, ...parts);
  };

  suite("getDocDoctorSettings", () => {
    test("DD-UT-014 getDocDoctorSettings returns defaults", () => {
      const settings = getDocDoctorSettings();
      assert.strictEqual(settings.checkMainFunction, false);
      assert.ok(Array.isArray(settings.fileWhitelist));
      assert.ok(typeof settings.functionWhitelist === "object");
      assert.ok(Array.isArray(settings.returnTypeWhitelist));
    });
  });

  suite("isFileWhitelisted", () => {
    test("DD-UT-015 isFileWhitelisted matches prefixes", () => {
      const settings: DocDoctorSettings = {
        checkMainFunction: false,
        fileWhitelist: ["test/", "src/legacy/"],
        functionWhitelist: {},
        returnTypeWhitelist: [],
      };

      assert.strictEqual(
        isFileWhitelisted(buildPath("test", "file.c"), settings),
        true
      );
      assert.strictEqual(
        isFileWhitelisted(buildPath("src", "legacy", "old.c"), settings),
        true
      );
      assert.strictEqual(
        isFileWhitelisted(buildPath("src", "new", "file.c"), settings),
        false
      );
    });

    test("DD-UT-016 isFileWhitelisted returns false for empty list", () => {
      const settings: DocDoctorSettings = {
        checkMainFunction: false,
        fileWhitelist: [],
        functionWhitelist: {},
        returnTypeWhitelist: [],
      };

      assert.strictEqual(
        isFileWhitelisted(buildPath("test", "file.c"), settings),
        false
      );
    });
  });

  suite("isFunctionWhitelisted", () => {
    test("DD-UT-017 isFunctionWhitelisted matches file-level entries", () => {
      const settings: DocDoctorSettings = {
        checkMainFunction: false,
        fileWhitelist: [],
        functionWhitelist: {
          "src/file1.c": ["function1", "int function2(int a)"],
        },
        returnTypeWhitelist: [],
      };
      const func = {
        filePath: buildPath("src", "file1.c"),
        functionName: "function1",
        functionSignature: "int function1()",
        comment: "",
        functionContent: "",
        lineNumber: 1,
        columnNumber: 1,
      };

      assert.strictEqual(isFunctionWhitelisted(func, settings), true);
    });

    test("DD-UT-018 isFunctionWhitelisted matches global entries", () => {
      const settings: DocDoctorSettings = {
        checkMainFunction: false,
        fileWhitelist: [],
        functionWhitelist: {
          "*": ["globalFunc"],
        },
        returnTypeWhitelist: [],
      };
      const func = {
        filePath: buildPath("src", "anyfile.c"),
        functionName: "globalFunc",
        functionSignature: "void globalFunc()",
        comment: "",
        functionContent: "",
        lineNumber: 1,
        columnNumber: 1,
      };

      assert.strictEqual(isFunctionWhitelisted(func, settings), true);
    });

    test("DD-UT-019 isFunctionWhitelisted returns false when missing", () => {
      const settings: DocDoctorSettings = {
        checkMainFunction: false,
        fileWhitelist: [],
        functionWhitelist: {
          "src/file1.c": ["otherFunc"],
        },
        returnTypeWhitelist: [],
      };
      const func = {
        filePath: buildPath("src", "file1.c"),
        functionName: "testFunc",
        functionSignature: "int testFunc()",
        comment: "",
        functionContent: "",
        lineNumber: 1,
        columnNumber: 1,
      };

      assert.strictEqual(isFunctionWhitelisted(func, settings), false);
    });
  });

  suite("isReturnTypeWhitelisted", () => {
    test("DD-UT-020 isReturnTypeWhitelisted matches void", () => {
      const settings: DocDoctorSettings = {
        checkMainFunction: false,
        fileWhitelist: [],
        functionWhitelist: {},
        returnTypeWhitelist: ["void"],
      };
      const func = {
        filePath: buildPath("src", "file.c"),
        functionName: "test",
        functionSignature: "void test()",
        comment: "",
        functionContent: "",
        lineNumber: 1,
        columnNumber: 1,
      };

      assert.strictEqual(isReturnTypeWhitelisted(func, settings), true);
    });

    test("DD-UT-021 isReturnTypeWhitelisted rejects non-whitelist", () => {
      const settings: DocDoctorSettings = {
        checkMainFunction: false,
        fileWhitelist: [],
        functionWhitelist: {},
        returnTypeWhitelist: ["void"],
      };
      const func = {
        filePath: buildPath("src", "file.c"),
        functionName: "test",
        functionSignature: "int test()",
        comment: "",
        functionContent: "",
        lineNumber: 1,
        columnNumber: 1,
      };

      assert.strictEqual(isReturnTypeWhitelisted(func, settings), false);
    });

    test("DD-UT-022 isReturnTypeWhitelisted supports multiword type", () => {
      const settings: DocDoctorSettings = {
        checkMainFunction: false,
        fileWhitelist: [],
        functionWhitelist: {},
        returnTypeWhitelist: ["unsigned long"],
      };
      const func = {
        filePath: buildPath("src", "file.c"),
        functionName: "getValue",
        functionSignature: "unsigned long getValue()",
        comment: "",
        functionContent: "",
        lineNumber: 1,
        columnNumber: 1,
      };

      assert.strictEqual(isReturnTypeWhitelisted(func, settings), true);
    });
  });

  suite("shouldSkipFunction", () => {
    test("DD-UT-023 shouldSkipFunction skips main by default", () => {
      const settings: DocDoctorSettings = {
        checkMainFunction: false,
        fileWhitelist: [],
        functionWhitelist: {},
        returnTypeWhitelist: [],
      };
      const func = {
        filePath: buildPath("src", "file.c"),
        functionName: "main",
        functionSignature: "int main(int argc, char* argv[])",
        comment: "",
        functionContent: "",
        lineNumber: 1,
        columnNumber: 1,
      };

      assert.strictEqual(shouldSkipFunction(func, settings), true);
    });

    test("DD-UT-024 shouldSkipFunction respects checkMainFunction", () => {
      const settings: DocDoctorSettings = {
        checkMainFunction: true,
        fileWhitelist: [],
        functionWhitelist: {},
        returnTypeWhitelist: [],
      };
      const func = {
        filePath: buildPath("src", "file.c"),
        functionName: "main",
        functionSignature: "int main(int argc, char* argv[])",
        comment: "",
        functionContent: "",
        lineNumber: 1,
        columnNumber: 1,
      };

      assert.strictEqual(shouldSkipFunction(func, settings), false);
    });

    test("DD-UT-025 shouldSkipFunction skips whitelisted files", () => {
      const settings: DocDoctorSettings = {
        checkMainFunction: false,
        fileWhitelist: ["test/"],
        functionWhitelist: {},
        returnTypeWhitelist: [],
      };
      const func = {
        filePath: buildPath("test", "file.c"),
        functionName: "testFunc",
        functionSignature: "int testFunc()",
        comment: "",
        functionContent: "",
        lineNumber: 1,
        columnNumber: 1,
      };

      assert.strictEqual(shouldSkipFunction(func, settings), true);
    });
  });
});
