import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ProblemInfo, ProblemType } from "./functionCheck";

/**
 * 数据库桥接层模块（TS部分）
 *
 * 本模块通过 koffi 调用 C++ 动态库，提供数据库存储和读取功能
 *
 * 数据库文件位置：<workspaceFolder>/.doc-doctor/problems.db
 */

// koffi 需要动态导入（避免在不支持的环境报错）
let koffi: typeof import("koffi") | null = null;
let nativeLib: NativeLib | null = null;
let dbInitialized = false;

/**
 * C++ 动态库接口类型定义
 */
interface NativeLib {
  initDatabase: (dbPath: string) => number;
  saveProblem: (jsonInput: string) => number;
  loadAllProblems: () => string | null;
  updateProblemStatus: (id: number, status: number) => number;
  clearProblems: () => number;
  closeDatabase: () => void;
}

/**
 * 数据库中存储的问题记录（包含 ID 和状态字段）
 */
export interface ProblemRecord extends ProblemInfo {
  id: number;
  checkTimestamp: string;
  status: ProblemStatus;
}

/**
 * 问题状态枚举
 */
export enum ProblemStatus {
  NORMAL = 0, // 正常
  IGNORED = 1, // 已完成/已忽略
}

/**
 * 存储操作结果
 */
export interface SaveResult {
  success: boolean;
  message: string;
  insertedId?: number;
}

/**
 * 读取操作结果
 */
export interface LoadResult {
  success: boolean;
  message: string;
  problems: ProblemRecord[];
}

/**
 * 初始化数据库模块
 * 加载 C++ 动态库并创建数据库连接
 *
 * @param extensionUri 扩展根目录 URI
 */
export function initDB(extensionUri: vscode.Uri): boolean {
  if (dbInitialized) {
    return true;
  }

  try {
    // 动态导入 koffi
    koffi = require("koffi");

    // 构建 DLL 路径
    const dllPath = path.join(
      extensionUri.fsPath,
      "native",
      "build",
      "Release",
      "doc_doctor_db.dll"
    );

    // 检查 DLL 是否存在
    if (!fs.existsSync(dllPath)) {
      console.error(`[Database] DLL not found: ${dllPath}`);
      vscode.window.showWarningMessage(
        `数据库模块未找到 DLL: ${dllPath}，将使用模拟数据`
      );
      return false;
    }

    // 加载动态库
    const lib = koffi!.load(dllPath);

    // 定义函数接口
    nativeLib = {
      initDatabase: lib.func("initDatabase", "int", ["str"]),
      saveProblem: lib.func("saveProblem", "int", ["str"]),
      loadAllProblems: lib.func("loadAllProblems", "str", []),
      updateProblemStatus: lib.func("updateProblemStatus", "int", ["int", "int"]),
      clearProblems: lib.func("clearProblems", "int", []),
      closeDatabase: lib.func("closeDatabase", "void", []),
    };

    // 获取工作区路径，创建数据库目录
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.error("[Database] No workspace folder found");
      return false;
    }

    const dbDir = path.join(workspaceFolders[0].uri.fsPath, ".doc-doctor");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, "problems.db");

    // 初始化数据库
    const rc = nativeLib.initDatabase(dbPath);
    if (rc !== 0) {
      console.error("[Database] Failed to initialize database");
      return false;
    }

    dbInitialized = true;
    console.log(`[Database] Initialized successfully: ${dbPath}`);
    return true;
  } catch (error) {
    console.error("[Database] Init error:", error);
    return false;
  }
}

/**
 * 检查数据库是否可用
 */
function isDBAvailable(): boolean {
  return dbInitialized && nativeLib !== null;
}

/**
 * 数据库存储模块（TS桥接层）
 *
 * @param problemInfo - 问题信息
 * @returns 存储结果
 */
export async function saveProblemToDB(
  problemInfo: ProblemInfo
): Promise<SaveResult> {
  try {
    if (!isDBAvailable()) {
      // 回退到模拟实现
      return mockSaveProblem(problemInfo);
    }

    const jsonInput = JSON.stringify({
      problem_type: problemInfo.problemType,
      file_path: problemInfo.filePath,
      function_signature: problemInfo.functionSignature,
      function_name: problemInfo.functionName,
      line_number: problemInfo.lineNumber,
      column_number: problemInfo.columnNumber,
      problem_description: problemInfo.problemDescription,
      function_snippet: problemInfo.functionSnippet,
      check_timestamp: new Date().toISOString(),
      status: ProblemStatus.NORMAL,
    });

    const insertedId = nativeLib!.saveProblem(jsonInput);

    if (insertedId > 0) {
      console.log(`[Database] Saved problem with ID: ${insertedId}`);
      return {
        success: true,
        message: "问题已成功存储到数据库",
        insertedId,
      };
    } else {
      return {
        success: false,
        message: "存储失败：数据库返回错误",
      };
    }
  } catch (error) {
    console.error("[Database] Save error:", error);
    return {
      success: false,
      message: `存储失败: ${(error as Error).message}`,
    };
  }
}

/**
 * 模拟存储（当 DLL 不可用时）
 */
function mockSaveProblem(problemInfo: ProblemInfo): SaveResult {
  const mockId = Math.floor(Math.random() * 10000);
  console.log(`[Database Mock] 存储问题:`, {
    id: mockId,
    type: ProblemType[problemInfo.problemType],
    function: problemInfo.functionName,
  });
  return {
    success: true,
    message: "问题已存储（模拟模式）",
    insertedId: mockId,
  };
}

/**
 * 批量存储问题到数据库
 */
export async function saveProblemsToDBBatch(
  problems: ProblemInfo[]
): Promise<SaveResult> {
  // 如果数据库可用，先清空旧数据
  if (isDBAvailable()) {
    nativeLib!.clearProblems();
  }

  let successCount = 0;
  let failCount = 0;

  for (const problem of problems) {
    const result = await saveProblemToDB(problem);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  return {
    success: failCount === 0,
    message: `成功存储 ${successCount} 个问题${
      failCount > 0 ? `，失败 ${failCount} 个` : ""
    }`,
  };
}

/**
 * 数据库读取模块（TS桥接层）
 */
export async function loadProblemsFromDB(): Promise<LoadResult> {
  try {
    if (!isDBAvailable()) {
      return mockLoadProblems();
    }

    const jsonString = nativeLib!.loadAllProblems();
    if (!jsonString) {
      return {
        success: false,
        message: "读取失败：数据库返回空",
        problems: [],
      };
    }

    const rawProblems = JSON.parse(jsonString);
    const problems: ProblemRecord[] = rawProblems.map((p: any) => ({
      id: p.id,
      problemType: p.problem_type,
      filePath: p.file_path,
      functionSignature: p.function_signature,
      functionName: p.function_name,
      lineNumber: p.line_number,
      columnNumber: p.column_number,
      problemDescription: p.problem_description,
      functionSnippet: p.function_snippet,
      checkTimestamp: p.check_timestamp,
      status: p.status,
    }));

    console.log(`[Database] Loaded ${problems.length} problems`);
    return {
      success: true,
      message: `成功读取 ${problems.length} 个问题`,
      problems,
    };
  } catch (error) {
    console.error("[Database] Load error:", error);
    return {
      success: false,
      message: `读取失败: ${(error as Error).message}`,
      problems: [],
    };
  }
}

/**
 * 模拟读取（当 DLL 不可用时）
 */
function mockLoadProblems(): LoadResult {
  const mockProblems: ProblemRecord[] = [
    {
      id: 1,
      problemType: ProblemType.BRIEF_MISSING,
      filePath: "src/main.c",
      functionName: "main",
      functionSignature: "int main(int argc, char* argv[])",
      lineNumber: 10,
      columnNumber: 5,
      problemDescription: "缺少函数功能描述（@brief）",
      functionSnippet: "int main(int argc, char* argv[]) { ... }",
      checkTimestamp: new Date().toISOString(),
      status: ProblemStatus.NORMAL,
    },
    {
      id: 2,
      problemType: ProblemType.PARAM_MISSING,
      filePath: "src/utils.c",
      functionName: "add",
      functionSignature: "int add(int a, int b)",
      lineNumber: 25,
      columnNumber: 5,
      problemDescription: '缺少参数 "a" 的说明（@param a）',
      functionSnippet: "int add(int a, int b) { return a + b; }",
      checkTimestamp: new Date().toISOString(),
      status: ProblemStatus.NORMAL,
    },
  ];

  console.log(`[Database Mock] 读取 ${mockProblems.length} 个问题`);
  return {
    success: true,
    message: `成功读取 ${mockProblems.length} 个问题（模拟模式）`,
    problems: mockProblems,
  };
}

/**
 * 更新问题状态
 */
export async function updateProblemStatusInDB(
  id: number,
  status: ProblemStatus
): Promise<boolean> {
  if (!isDBAvailable()) {
    console.log(`[Database Mock] 更新问题状态: id=${id}, status=${status}`);
    return true;
  }

  try {
    const rc = nativeLib!.updateProblemStatus(id, status);
    return rc === 0;
  } catch (error) {
    console.error("[Database] Update status error:", error);
    return false;
  }
}

/**
 * 清空所有问题
 */
export async function clearAllProblems(): Promise<boolean> {
  if (!isDBAvailable()) {
    console.log("[Database Mock] 清空所有问题");
    return true;
  }

  try {
    const rc = nativeLib!.clearProblems();
    return rc === 0;
  } catch (error) {
    console.error("[Database] Clear error:", error);
    return false;
  }
}

/**
 * 提供给命令使用的封装：测试数据库存储功能
 */
export async function testSaveToDatabase(
  webview?: vscode.Webview
): Promise<void> {
  const mockProblem: ProblemInfo = {
    problemType: ProblemType.BRIEF_MISSING,
    filePath: "test/demo.c",
    functionName: "testFunction",
    functionSignature: "void testFunction(int x)",
    lineNumber: 1,
    columnNumber: 1,
    problemDescription: "测试问题：缺少函数功能描述",
    functionSnippet: "void testFunction(int x) { }",
  };

  const result = await saveProblemToDB(mockProblem);

  vscode.window.showInformationMessage(
    `数据库存储测试: ${result.message}${
      result.insertedId ? ` (ID: ${result.insertedId})` : ""
    }`
  );

  if (webview) {
    webview.postMessage({
      type: "databaseSaveResult",
      result,
    });
  }
}

/**
 * 提供给命令使用的封装：测试数据库读取功能
 */
export async function testLoadFromDatabase(
  webview?: vscode.Webview
): Promise<void> {
  const result = await loadProblemsFromDB();

  vscode.window.showInformationMessage(`数据库读取测试: ${result.message}`);

  if (webview) {
    webview.postMessage({
      type: "databaseLoadResult",
      result,
    });
  }
}
