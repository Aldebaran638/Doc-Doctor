import * as vscode from "vscode";
import { checkFile, FunctionInfo, parseFileContent } from "./fileCheck";
import { checkFunction, ProblemInfo, ProblemType } from "./functionCheck";
import { saveProblemsToDBBatch, setLastProblemsForDebug } from "./database";
import {
  DocDoctorSettings,
  getDocDoctorSettings,
  isFileWhitelisted,
  shouldSkipFunction,
} from "./fileWhiteList";
import * as gitExtension from "../git";

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
  /** Git 变更检测相关提示信息，例如“未使用 git，已跳过变更检测”等 */
  gitMessage?: string;
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
    const config = vscode.workspace.getConfiguration("doc-doctor");

    /** 是否启用基于 Git 的内容变更警告 */
    const enableGitChangeWarning = config.get<boolean>(
      "enableGitChangeWarning",
      true
    );

    /** 本次检查是否实际启用了 Git 变更检测（受配置和环境影响） */
    let gitCheckActive = false;
    /** 自 HEAD~1 以来发生变更的 .c 文件绝对路径集合 */
    let changedCFiles: Set<string> = new Set();
    /** 旧版本（HEAD~1）中各文件的函数信息，按 filePath -> functionSignature 映射 */
    const oldFunctionsByFile: Map<
      string,
      Map<string, FunctionInfo>
    > = new Map();

    console.log(
      "[Doc-Doctor][GitCheck] enableGitChangeWarning =",
      enableGitChangeWarning
    );

    if (enableGitChangeWarning) {
      try {
        const gitExt =
          vscode.extensions.getExtension<gitExtension.GitExtension>(
            "vscode.git"
          );

        if (!gitExt) {
          result.gitMessage =
            "Doc-Doctor: 未找到 Git 扩展，已跳过内容变更检测。";
          console.warn(
            "[Doc-Doctor][GitCheck] vscode.git 扩展不存在，跳过 Git 检测"
          );
        } else {
          const api = gitExt.exports.getAPI(1);
          const repo =
            (workspaceFolders &&
              workspaceFolders.length > 0 &&
              api.getRepository(workspaceFolders[0].uri)) ||
            api.repositories[0];

          if (!repo) {
            result.gitMessage =
              "Doc-Doctor: 当前项目未使用 git，已跳过内容变更检测。";
            console.warn(
              "[Doc-Doctor][GitCheck] 未找到可用仓库，跳过 Git 检测"
            );
          } else {
            // 检查提交历史是否至少有两条
            const history = await repo.log({ maxEntries: 2 });
            console.log(
              "[Doc-Doctor][GitCheck] 当前仓库最近提交数量 =",
              history ? history.length : 0
            );
            if (!history || history.length < 2) {
              result.gitMessage =
                "Doc-Doctor: 当前仓库历史不足两条提交，已跳过内容变更检测（仅从第二次提交开始启用）。";
            } else {
              // 获取 HEAD~1 到 HEAD 之间的变更文件列表
              const changes = await repo.diffBetween("HEAD~1", "HEAD");
              console.log(
                "[Doc-Doctor][GitCheck] diffBetween(HEAD~1, HEAD) 返回条数 =",
                changes.length
              );
              const tmpChangedC = new Set<string>();
              for (const change of changes) {
                const fsPath = change.uri.fsPath;
                if (fsPath.endsWith(".c")) {
                  tmpChangedC.add(fsPath);
                }
              }

              console.log(
                "[Doc-Doctor][GitCheck] 变更的 .c 文件列表 =",
                Array.from(tmpChangedC.values())
              );

              if (tmpChangedC.size === 0) {
                gitCheckActive = false;
              } else {
                // 为每个变更的 .c 文件解析 HEAD~1 中的函数信息
                for (const fsPath of tmpChangedC) {
                  try {
                    console.log(
                      "[Doc-Doctor][GitCheck] 解析历史版本函数信息:",
                      fsPath
                    );
                    const oldContent = await repo.show("HEAD~1", fsPath);
                    const parseResult = parseFileContent(oldContent, fsPath);
                    if (!parseResult.success) {
                      console.warn(
                        "[Doc-Doctor][GitCheck] 解析历史版本失败, file =",
                        fsPath,
                        "error =",
                        parseResult.errorCode,
                        parseResult.error
                      );
                      continue;
                    }
                    const bySig = new Map<string, FunctionInfo>();
                    for (const f of parseResult.functions) {
                      bySig.set(f.functionSignature, f);
                    }
                    oldFunctionsByFile.set(fsPath, bySig);
                  } catch {
                    // 单个文件失败不影响整体
                    console.warn(
                      "[Doc-Doctor][GitCheck] 获取或解析 HEAD~1 版本内容时异常, file =",
                      fsPath
                    );
                  }
                }

                changedCFiles = tmpChangedC;
                gitCheckActive = oldFunctionsByFile.size > 0;
                console.log(
                  "[Doc-Doctor][GitCheck] gitCheckActive =",
                  gitCheckActive,
                  "oldFunctionsByFile.size =",
                  oldFunctionsByFile.size
                );
                if (!gitCheckActive) {
                  result.gitMessage =
                    "Doc-Doctor: 无法解析历史版本函数信息，已跳过内容变更检测。";
                }
              }
            }
          }
        }
      } catch (e) {
        // 任意异常都不影响主流程，只输出提示信息
        result.gitMessage =
          "Doc-Doctor: Git 变更检测失败，已跳过内容变更分析：" +
          (e instanceof Error ? e.message : String(e));
      }
    }

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

      // 通过 VS Code 诊断获取该文件的语法/编译错误，并生成一条汇总语法错误问题项
      // 如果存在语法错误，则不对该文件做后续的注释检查
      let hasSyntaxError = false;
      try {
        const diagnostics = vscode.languages.getDiagnostics(fileUri) || [];
        let firstError: vscode.Diagnostic | undefined;
        let errorCount = 0;

        for (const diag of diagnostics) {
          if (diag.severity !== vscode.DiagnosticSeverity.Error) {
            continue;
          }

          errorCount++;
          if (!firstError) {
            firstError = diag;
          }
        }

        if (firstError) {
          hasSyntaxError = true;

          const line = firstError.range.start.line + 1;
          const col = firstError.range.start.character + 1;
          const summary =
            errorCount > 1
              ? `该文件存在 ${errorCount} 处语法错误（示例：${firstError.message}）`
              : `语法错误: ${firstError.message}`;

          const syntaxProblem: ProblemInfo = {
            problemType: ProblemType.SYNTAX_ERROR,
            filePath: fileUri.fsPath,
            functionName: "(语法错误)",
            functionSignature: "",
            lineNumber: line,
            columnNumber: col,
            problemDescription: summary,
            functionSnippet: "",
          };

          result.problems.push(syntaxProblem);

          if (result.problems.length >= 1000) {
            result.errorMessage = "已达到最大问题数量限制（1000），停止检查";
            break;
          }
        }

        if (result.problems.length >= 1000) {
          break;
        }
      } catch {
        // 诊断获取失败不影响后续注释检查
      }

      if (hasSyntaxError) {
        result.skippedFiles.push(
          `${relativePath} (存在语法错误，已跳过注释检查)`
        );
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

        // 基于 Git 的内容变更警告（仅对 .c 文件启用）
        if (
          gitCheckActive &&
          fileUri.fsPath.endsWith(".c") &&
          changedCFiles.has(fileUri.fsPath)
        ) {
          console.log(
            "[Doc-Doctor][GitCheck] 检查函数是否发生变更:",
            "file =",
            fileUri.fsPath,
            "signature =",
            funcInfo.functionSignature
          );
          const oldBySig = oldFunctionsByFile.get(fileUri.fsPath);
          if (oldBySig) {
            const oldFunc = oldBySig.get(funcInfo.functionSignature);
            // 仅对既有函数进行变更判断；新增函数不报变更警告
            if (oldFunc) {
              const changed =
                hasFunctionBodyChangedIgnoringWhitespaceAndComments(
                  oldFunc.functionContent,
                  funcInfo.functionContent
                );
              console.log(
                "[Doc-Doctor][GitCheck] 函数变更比较结果:",
                "signature =",
                funcInfo.functionSignature,
                "changed =",
                changed
              );
              if (changed) {
                const changeProblem: ProblemInfo = {
                  problemType: ProblemType.CONTENT_CHANGED,
                  filePath: funcInfo.filePath,
                  functionName: funcInfo.functionName,
                  functionSignature: funcInfo.functionSignature,
                  lineNumber: funcInfo.lineNumber,
                  columnNumber: funcInfo.columnNumber,
                  problemDescription:
                    "函数体相对于上一次提交发生变更，请检查注释是否同步更新。",
                  functionSnippet: funcInfo.functionContent.slice(0, 200),
                };
                result.problems.push(changeProblem);
              } else {
                console.log(
                  "[Doc-Doctor][GitCheck] 函数在忽略空白和注释后未检测到实质变更, 不生成变更警告。"
                );
              }
            } else {
              console.log(
                "[Doc-Doctor][GitCheck] 在历史版本中未找到同签名函数, 视为新增函数, 不生成变更警告。",
                "signature =",
                funcInfo.functionSignature
              );
            }
          } else {
            console.log(
              "[Doc-Doctor][GitCheck] 当前文件在 oldFunctionsByFile 中没有记录, file =",
              fileUri.fsPath
            );
          }
        }
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
 * 比较两个函数体内容是否发生实质性变更：
 * - 忽略空格、缩进、换行等空白字符；
 * - 忽略行注释 //... 和块注释 /* ... *\/。
 */
function hasFunctionBodyChangedIgnoringWhitespaceAndComments(
  oldBody: string,
  newBody: string
): boolean {
  const normalize = (code: string): string => {
    // 去掉块注释
    let text = code.replace(/\/\*[\s\S]*?\*\//g, "");
    // 去掉行注释
    text = text.replace(/\/\/.*$/gm, "");
    // 去掉所有空白字符
    text = text.replace(/\s+/g, "");
    return text.trim();
  };

  const oldNorm = normalize(oldBody || "");
  const newNorm = normalize(newBody || "");
  return oldNorm !== newNorm;
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
        if (result.gitMessage) {
          webview.postMessage({ type: "log", message: result.gitMessage });
        }
        webview.postMessage({
          type: "projectCheckResult",
          result,
        });
      }

      // 记录最近一次检查的问题列表，供调试功能使用
      if (result.success) {
        setLastProblemsForDebug(result.problems);

        // 自动将本次检查结果写入数据库，并输出提示
        try {
          const saveResult = await saveProblemsToDBBatch(result.problems);
          const prefix =
            result.problems.length > 0
              ? "检查结果已保存到数据库："
              : "数据库已同步为空结果：";

          vscode.window.showInformationMessage(prefix + saveResult.message);

          if (webview) {
            webview.postMessage({
              type: "databaseSaveResult",
              result: saveResult,
            });
          }
        } catch (e) {
          console.error("[Doc-Doctor] 自动保存检查结果到数据库失败:", e);
        }
      }

      return result;
    }
  );
}
