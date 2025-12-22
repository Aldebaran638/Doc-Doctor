import * as vscode from "vscode";
import { ProblemInfo, ProblemType } from "./functionCheck";

/**
 * 数据库桥接层模块（TS部分）
 *
 * 本模块用于与 C++ 动态库对接，提供数据库存储和读取功能
 *
 * 数据库文件位置：<workspaceFolder>/doc-doctor/database/problems.db
 */

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
 * 数据库存储模块（TS桥接层）
 *
 * 输入：ProblemInfo - 函数问题相关信息
 * 输出：SaveResult - 是否存储成功的flag和消息
 *
 * TODO: 当前为模拟实现，未来需要调用 C++ 动态库
 *
 * @param problemInfo - 问题信息
 * @returns 存储结果
 */
export async function saveProblemToDB(
  problemInfo: ProblemInfo
): Promise<SaveResult> {
  try {
    // TODO: 调用 C++ 动态库的 saveProblem 函数
    // const jsonString = JSON.stringify({
    //   problem_type: problemInfo.problemType,
    //   file_path: problemInfo.filePath,
    //   function_signature: problemInfo.functionSignature,
    //   function_name: problemInfo.functionName,
    //   line_number: problemInfo.lineNumber,
    //   column_number: problemInfo.columnNumber,
    //   problem_description: problemInfo.problemDescription,
    //   function_snippet: problemInfo.functionSnippet,
    //   check_timestamp: new Date().toISOString(),
    //   status: ProblemStatus.NORMAL
    // });
    // const insertedId = await callCppSaveProblem(jsonString);

    // 当前为模拟实现
    const mockId = Math.floor(Math.random() * 10000);

    console.log(`[Database TS Bridge] 存储问题到数据库:`, {
      id: mockId,
      type: ProblemType[problemInfo.problemType],
      function: problemInfo.functionName,
      file: problemInfo.filePath,
    });

    return {
      success: true,
      message: "问题已成功存储到数据库（模拟）",
      insertedId: mockId,
    };
  } catch (error) {
    return {
      success: false,
      message: `存储失败: ${(error as Error).message}`,
    };
  }
}

/**
 * 批量存储问题到数据库
 *
 * @param problems - 问题列表
 * @returns 存储结果摘要
 */
export async function saveProblemsToDBBatch(
  problems: ProblemInfo[]
): Promise<SaveResult> {
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
 *
 * 输入：无
 * 输出：LoadResult - 数据库中所有函数问题相关信息
 *
 * TODO: 当前为模拟实现，未来需要调用 C++ 动态库
 *
 * @returns 读取结果
 */
export async function loadProblemsFromDB(): Promise<LoadResult> {
  try {
    // TODO: 调用 C++ 动态库的 loadAllProblems 函数
    // const jsonString = await callCppLoadAllProblems();
    // const problems: ProblemRecord[] = JSON.parse(jsonString);

    // 当前为模拟实现
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

    console.log(
      `[Database TS Bridge] 从数据库读取 ${mockProblems.length} 个问题（模拟）`
    );

    return {
      success: true,
      message: `成功读取 ${mockProblems.length} 个问题（模拟）`,
      problems: mockProblems,
    };
  } catch (error) {
    return {
      success: false,
      message: `读取失败: ${(error as Error).message}`,
      problems: [],
    };
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
