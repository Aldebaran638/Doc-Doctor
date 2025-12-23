import * as vscode from "vscode";
import { checkFile, FunctionInfo } from "./fileCheck";
import { checkFunction, ProblemInfo } from "./functionCheck";
import {
  DocDoctorSettings,
  getDocDoctorSettings,
  isFileWhitelisted,
  shouldSkipFunction,
} from "./fileWhiteList";

/**
 * 总检查模块
 *
 * 输入：无（扫描当前工作区所有 .c/.cpp 文件）
 * 输出：CheckAllResult - 包含所有检查到的问题列表
 */

export interface CheckAllResult {
  success: boolean;
  totalFiles: number;
  checkedFiles: number;
  skippedFiles: string[]; // 跳过的文件列表（语法错误/权限问题/过大等）
  problems: ProblemInfo[];
  errorMessage?: string;
}

/**
 * 检查整个工作区的所有 C/C++ 文件
 *
 * @param progressCallback - 可选的进度回调函数，用于报告检查进度
 * @returns 检查结果
 */
export async function checkAllFiles(
  progressCallback?: (message: string) => void
): Promise<CheckAllResult> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return {
      success: false,
      totalFiles: 0,
      checkedFiles: 0,
      skippedFiles: [],
      problems: [],
      errorMessage: "未找到工作区文件夹",
    };
  }

  const result: CheckAllResult = {
    success: true,
    totalFiles: 0,
    checkedFiles: 0,
    skippedFiles: [],
    problems: [],
  };

  try {
    // 读取当前白名单相关设置
    const settings: DocDoctorSettings = getDocDoctorSettings();

    // 查找所有 .c 和 .cpp 文件
    const files = await vscode.workspace.findFiles(
      "**/*.{c,cpp}",
      "**/node_modules/**",
      1000 // 最多查找 1000 个文件
    );

    result.totalFiles = files.length;

    if (files.length === 0) {
      result.errorMessage = "工作区中未找到 C/C++ 文件";
      return result;
    }

    // 逐个检查文件
    for (const fileUri of files) {
      const relativePath = vscode.workspace.asRelativePath(fileUri, false);

      // 文件白名单：被标记为白名单的文件直接跳过
      if (isFileWhitelisted(fileUri.fsPath, settings)) {
        result.skippedFiles.push(`${relativePath} (文件在白名单中)`);
        continue;
      }

      // 报告进度
      if (progressCallback) {
        progressCallback(`正在检查文件: ${relativePath}`);
      }

      // 检查文件大小（跳过超过 1MB 的文件）
      try {
        const stat = await vscode.workspace.fs.stat(fileUri);
        if (stat.size > 1024 * 1024) {
          result.skippedFiles.push(
            `${relativePath} (文件过大: ${(stat.size / 1024 / 1024).toFixed(
              2
            )}MB)`
          );
          continue;
        }
      } catch (err) {
        result.skippedFiles.push(`${relativePath} (无法读取文件信息)`);
        continue;
      }

      // 解析文件
      const parseResult = await checkFile(fileUri);

      if (!parseResult.success) {
        result.skippedFiles.push(
          `${relativePath} (${parseResult.errorCode}: ${parseResult.error})`
        );
        continue;
      }

      // 检查每个函数，应用函数/返回类型/主函数白名单规则
      for (const funcInfo of parseResult.functions) {
        if (shouldSkipFunction(funcInfo, settings)) {
          continue;
        }

        const funcProblems = checkFunction(funcInfo);
        result.problems.push(...funcProblems);
      }

      result.checkedFiles++;

      // 限制最多检查 1000 个问题
      if (result.problems.length >= 1000) {
        result.errorMessage = "已达到最大问题数量限制（1000），停止检查";
        break;
      }
    }
  } catch (error) {
    result.success = false;
    result.errorMessage = `检查过程中发生错误: ${(error as Error).message}`;
  }

  return result;
}

/**
 * 对外暴露的封装函数：检查所有文件并通过 VS Code UI 展示结果
 *
 * @param webview - 可选的 webview 实例，用于回传结果到前端
 */
export async function runProjectCheck(webview?: vscode.Webview): Promise<void> {
  // 显示进度提示
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Doc-Doctor 项目检查",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "正在扫描工作区..." });

      const result = await checkAllFiles((message) => {
        progress.report({ message });
      });

      // 显示结果摘要
      if (!result.success) {
        vscode.window.showErrorMessage(`检查失败: ${result.errorMessage}`);
      } else if (result.problems.length === 0) {
        vscode.window.showInformationMessage(
          `项目目前不存在相关问题噢！\n已检查 ${result.checkedFiles}/${result.totalFiles} 个文件`
        );
      } else {
        vscode.window.showInformationMessage(
          `检查完成！共发现 ${result.problems.length} 个问题\n已检查 ${result.checkedFiles}/${result.totalFiles} 个文件`
        );
      }

      // 如果有 webview，回传结果
      if (webview) {
        webview.postMessage({
          type: "projectCheckResult",
          result,
        });
      }

      return result;
    }
  );
}
