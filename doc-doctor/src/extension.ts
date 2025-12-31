// 模块 'vscode' 包含了 VS Code 的扩展 API
// 导入该模块，并在下方代码中用 vscode 作为别名引用
import * as vscode from "vscode";
import { pickAndCheckFile } from "./modules/fileCheck";
import { runProjectCheck } from "./modules/projectCheck";
import { jumpToLocation, testJumpToLocation } from "./modules/jumpToLocation";
import {
  testSaveToDatabase,
  testLoadFromDatabase,
  loadProblemsFromDB,
  initDB,
  updateProblemStatusInDB,
  ProblemStatus,
} from "./modules/database";
import { generateCommentWithAI, applyAIFixToFile } from "./modules/aiRefactor";
import { initSecretStorage, getApiKey, setApiKey } from "./modules/secretStorage";

// 注册侧边栏 WebviewViewProvider
class DocDoctorSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "doc-doctor.sidebarView";
  private _currentWebview: vscode.Webview | undefined;
  private _currentCheckCancellationToken: vscode.CancellationTokenSource | undefined;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    this._currentWebview = webviewView.webview;

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // 每次视图被解析或重新可见时，从数据库加载已有问题并展示到“问题展示区”
    const refreshFromDatabase = async () => {
      try {
        // 可能存在：扩展激活时工作区尚未打开，导致 initDB 失败。
        // 这里在侧边栏可见时重试初始化，确保能读取到真实数据库。
        const ok = initDB(this._extensionUri);
        void ok;

        const result = await loadProblemsFromDB();
        webviewView.webview.postMessage({
          type: "databaseLoadResult",
          result,
        });
      } catch (err) {
        console.error("[Doc-Doctor] 自动从数据库加载问题失败:", err);
      }
    };

    // 首次打开侧边栏时加载一次
    refreshFromDatabase();

    // 当用户在不同侧边栏之间切换时，如果本视图重新可见，再加载一次
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        refreshFromDatabase();
      }
    });

    // 监听来自 Webview 的消息，用于触发各个模块的测试功能
    webviewView.webview.onDidReceiveMessage(async (message: any) => {
      console.log("[Doc-Doctor] 收到 Webview 消息:", message?.type, message);
      switch (message?.type) {
        case "requestSettings": {
          // Webview 主动请求当前配置，用于初始化设置页
          await this.postCurrentSettings(webviewView.webview);
          // requestSettings 一定发生在 Webview 脚本已加载之后；
          // 在这里刷新一次，避免 resolveWebviewView 初次 postMessage 过早被丢弃。
          await refreshFromDatabase();
          break;
        }
        case "runSingleFileCheck":
          await pickAndCheckFile(webviewView.webview);
          break;
        case "runProjectCheck": {
          // 如果已有正在进行的检查，先取消它
          if (this._currentCheckCancellationToken) {
            this._currentCheckCancellationToken.cancel();
            this._currentCheckCancellationToken.dispose();
          }

          // 创建新的取消令牌
          this._currentCheckCancellationToken = new vscode.CancellationTokenSource();
          const token = this._currentCheckCancellationToken.token;

          // 启动检查（异步执行，不等待）
          runProjectCheck(webviewView.webview, token).finally(() => {
            // 检查完成后清理
            if (this._currentCheckCancellationToken) {
              this._currentCheckCancellationToken.dispose();
              this._currentCheckCancellationToken = undefined;
            }
          });
          break;
        }
        case "testJumpToLocation":
          await testJumpToLocation(webviewView.webview);
          break;
        case "testSaveToDatabase":
          await testSaveToDatabase(
            webviewView.webview,
            message?.data?.problems
          );
          break;
        case "testLoadFromDatabase":
          await testLoadFromDatabase(webviewView.webview);
          break;
        case "aiFixComment": {
          console.log("[Doc-Doctor] 收到 AI 修复请求");
          (async () => {
            try {
              const problem = message?.data?.problem as any;
              if (!problem) {
                throw new Error("未传入有效的问题信息");
              }
              // 获取函数上下文以获取旧注释
              const { getFunctionContextFromProblem } = await import(
                "./modules/aiRefactor.js"
              );
              let oldComment: string | undefined = undefined;
              try {
                const funcInfo = await getFunctionContextFromProblem(problem);
                oldComment = funcInfo.comment;
              } catch {
                // 如果获取失败，继续处理，oldComment 为 undefined
              }
              
              const result = await generateCommentWithAI(problem);
              console.log("[Doc-Doctor] AI 修复完成，已生成注释预览");
              webviewView.webview.postMessage({
                type: "aiFixPreview",
                data: {
                  problem,
                  newComment: result.newComment,
                  oldComment: oldComment || "",
                },
              });
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : String(err ?? "未知错误");
              console.error("[Doc-Doctor] AI 修复注释失败:", msg);
              vscode.window.showErrorMessage(`AI 修复注释失败：${msg}`);
              webviewView.webview.postMessage({
                type: "aiFixError",
                message: msg,
              });
            }
          })();
          break;
        }
        case "applyAIFix": {
          (async () => {
            try {
              const problem = message?.data?.problem as any;
              const newComment = message?.data?.newComment as string;
              
              if (!problem || !newComment) {
                throw new Error("未传入有效的问题信息或注释内容");
              }
              
              const success = await applyAIFixToFile(problem, newComment);
              
              if (success) {
                vscode.window.showInformationMessage(
                  `AI 修复已应用到文件：${problem.filePath}`
                );
                
                // 如果问题有 id，自动更新状态为已完成
                if (problem.id != null && typeof problem.id === "number") {
                  try {
                    const updateSuccess = await updateProblemStatusInDB(
                      problem.id,
                      ProblemStatus.IGNORED
                    );
                    if (updateSuccess) {
                      console.log(
                        `[Doc-Doctor] 问题状态已自动更新为已完成: id=${problem.id}`
                      );
                      // 通知前端更新状态
                      webviewView.webview.postMessage({
                        type: "problemStatusUpdated",
                        data: {
                          id: problem.id,
                          status: ProblemStatus.IGNORED,
                          success: true,
                        },
                      });
                    } else {
                      console.warn(
                        `[Doc-Doctor] 自动更新问题状态失败: id=${problem.id}`
                      );
                    }
                  } catch (statusError) {
                    console.error(
                      `[Doc-Doctor] 更新问题状态时发生异常:`,
                      statusError
                    );
                    // 状态更新失败不影响主流程，继续执行
                  }
                }
                
                webviewView.webview.postMessage({
                  type: "aiFixApplied",
                  data: {
                    problem,
                    success: true,
                  },
                });
              } else {
                throw new Error("应用修复失败");
              }
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : String(err ?? "未知错误");
              console.error("[Doc-Doctor] 应用 AI 修复失败:", msg);
              vscode.window.showErrorMessage(`应用 AI 修复失败：${msg}`);
              webviewView.webview.postMessage({
                type: "aiFixError",
                message: msg,
              });
            }
          })();
          break;
        }
        case "jumpToProblem": {
          const filePath = message?.data?.filePath;
          const line = message?.data?.line;
          const col = message?.data?.col;
          const functionName = message?.data?.functionName as
            | string
            | undefined;
          if (
            typeof filePath === "string" &&
            typeof line === "number" &&
            typeof col === "number"
          ) {
            await jumpToLocation(filePath, line, col, functionName);
          } else {
            vscode.window.showErrorMessage("跳转失败：缺少 filePath/line/col");
          }
          break;
        }
        case "saveSettings": {
          (async () => {
            const settings = message?.data as {
              checkMain?: boolean;
              fileWhitelist?: string;
              funcWhitelist?: string;
              returnTypeWhitelist?: string;
              aiEnabled?: boolean;
              aiEndpoint?: string;
              aiApiKey?: string;
              aiModel?: string;
              aiTemperature?: number;
              aiTimeout?: number;
            };

            console.log("[Doc-Doctor] 保存设置:", settings);

            const config = vscode.workspace.getConfiguration("doc-doctor");

            try {
              // 1. 主函数检查开关
              await config.update(
                "checkMainFunction",
                !!settings?.checkMain,
                vscode.ConfigurationTarget.Workspace
              );

              // 2. 文件白名单：多行文本，每行一个前缀
              const fileWhitelistArray = (settings?.fileWhitelist || "")
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0);

              await config.update(
                "fileWhitelist",
                fileWhitelistArray,
                vscode.ConfigurationTarget.Workspace
              );

              // 3. 函数白名单：
              //    - 支持 "相对文件路径:函数签名或函数名"（精确到文件）
              //    - 也支持仅写函数名，表示全局函数白名单
              const funcWhitelistRaw = (settings?.funcWhitelist || "")
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0);

              const funcWhitelist: Record<string, string[]> = {};
              const globalFuncs: string[] = [];
              for (const line of funcWhitelistRaw) {
                const idx = line.indexOf(":");
                if (idx <= 0) {
                  // 仅函数名：加入全局白名单
                  globalFuncs.push(line.trim());
                } else {
                  const file = line.slice(0, idx).trim();
                  const func = line.slice(idx + 1).trim();
                  if (!file || !func) {
                    continue;
                  }
                  if (!funcWhitelist[file]) {
                    funcWhitelist[file] = [];
                  }
                  funcWhitelist[file].push(func);
                }
              }

              if (globalFuncs.length > 0) {
                funcWhitelist["*"] = globalFuncs;
              }

              await config.update(
                "functionWhitelist",
                funcWhitelist,
                vscode.ConfigurationTarget.Workspace
              );

              // 4. 返回值类型白名单：每行一个返回值类型，例如 "void"
              const returnTypeWhitelistArray = (
                settings?.returnTypeWhitelist || ""
              )
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0);

              await config.update(
                "returnTypeWhitelist",
                returnTypeWhitelistArray,
                vscode.ConfigurationTarget.Workspace
              );

              // 5. AI 修复配置
              await config.update(
                "enableAIRefactor",
                !!settings?.aiEnabled,
                vscode.ConfigurationTarget.Workspace
              );

              await config.update(
                "ai.endpoint",
                settings?.aiEndpoint?.trim() || "",
                vscode.ConfigurationTarget.Workspace
              );

              // API Key 使用 SecretStorage 安全存储
              if (settings?.aiApiKey !== undefined) {
                await setApiKey(settings.aiApiKey?.trim() || undefined);
              }

              await config.update(
                "ai.model",
                settings?.aiModel?.trim() || "gpt-4",
                vscode.ConfigurationTarget.Workspace
              );

              const temperature = settings?.aiTemperature;
              if (temperature !== undefined && temperature !== null) {
                const tempValue = Math.max(0, Math.min(2, Number(temperature)));
                await config.update(
                  "ai.temperature",
                  tempValue,
                  vscode.ConfigurationTarget.Workspace
                );
              }

              const timeout = settings?.aiTimeout;
              if (timeout !== undefined && timeout !== null) {
                const timeoutValue = Math.max(1000, Number(timeout)); // 最少1秒
                await config.update(
                  "ai.timeout",
                  timeoutValue,
                  vscode.ConfigurationTarget.Workspace
                );
              }

              vscode.window.showInformationMessage("Doc-Doctor 设置已保存");

              webviewView.webview.postMessage({
                type: "settingsSaved",
                success: true,
              });

              // 可选：保存设置后自动重新检查整个项目
              // 如果已有正在进行的检查，先取消它
              if (this._currentCheckCancellationToken) {
                this._currentCheckCancellationToken.cancel();
                this._currentCheckCancellationToken.dispose();
              }

              // 创建新的取消令牌
              this._currentCheckCancellationToken = new vscode.CancellationTokenSource();
              const token = this._currentCheckCancellationToken.token;

              // 启动检查（异步执行，不等待）
              runProjectCheck(webviewView.webview, token).finally(() => {
                // 检查完成后清理
                if (this._currentCheckCancellationToken) {
                  this._currentCheckCancellationToken.dispose();
                  this._currentCheckCancellationToken = undefined;
                }
              });
            } catch (err) {
              console.error("[Doc-Doctor] 保存设置失败:", err);
              vscode.window.showErrorMessage(
                `保存 Doc-Doctor 设置失败: ${(err as Error).message}`
              );
              webviewView.webview.postMessage({
                type: "settingsSaved",
                success: false,
              });
            }
          })();

          break;
        }
        case "updateProblemStatus": {
          const problemId = message?.data?.id;
          const status = message?.data?.status;
          console.log(
            `[Doc-Doctor] 更新问题状态: id=${problemId}, status=${status}`
          );

          // 验证参数
          if (typeof problemId !== "number" || typeof status !== "number") {
            webviewView.webview.postMessage({
              type: "problemStatusUpdated",
              data: {
                id: problemId,
                status: status,
                success: false,
                error: "参数无效",
              },
            });
            break;
          }

          // 调用数据库更新函数
          try {
            const success = await updateProblemStatusInDB(
              problemId,
              status as ProblemStatus
            );
            if (success) {
              console.log(
                `[Doc-Doctor] 问题状态更新成功: id=${problemId}, status=${status}`
              );
              webviewView.webview.postMessage({
                type: "problemStatusUpdated",
                data: { id: problemId, status: status, success: true },
              });
            } else {
              console.error(
                `[Doc-Doctor] 问题状态更新失败: id=${problemId}, status=${status}`
              );
              webviewView.webview.postMessage({
                type: "problemStatusUpdated",
                data: {
                  id: problemId,
                  status: status,
                  success: false,
                  error: "数据库更新失败",
                },
              });
            }
          } catch (error) {
            console.error(
              `[Doc-Doctor] 更新问题状态时发生异常:`,
              error
            );
            webviewView.webview.postMessage({
              type: "problemStatusUpdated",
              data: {
                id: problemId,
                status: status,
                success: false,
                error: (error as Error).message || "未知错误",
              },
            });
          }
          break;
        }
        case "cancelCheck": {
          console.log("[Doc-Doctor] 用户请求取消检查");
          if (this._currentCheckCancellationToken) {
            this._currentCheckCancellationToken.cancel();
            this._currentCheckCancellationToken.dispose();
            this._currentCheckCancellationToken = undefined;
            vscode.window.showInformationMessage("检查已取消");
            webviewView.webview.postMessage({ type: "checkCancelled" });
          } else {
            console.log("[Doc-Doctor] 当前没有正在进行的检查");
            webviewView.webview.postMessage({ type: "checkCancelled" });
          }
          break;
        }
        case "tabDebug": {
          const text = message?.message ? String(message.message) : "(empty)";
          console.log("[Doc-Doctor] Webview TabDebug:", text);
          break;
        }
      }
    });
  }

  /**
   * 将当前 doc-doctor 相关设置发送给 Webview，用于初始化设置页面
   */
  private async postCurrentSettings(webview: vscode.Webview) {
    const config = vscode.workspace.getConfiguration("doc-doctor");

    const checkMain = config.get<boolean>("checkMainFunction", false);
    const fileWhitelistArray = config.get<string[]>("fileWhitelist", []) ?? [];
    const funcWhitelistObj =
      config.get<Record<string, string[]>>("functionWhitelist", {}) ?? {};
    const returnTypeWhitelistArray =
      config.get<string[]>("returnTypeWhitelist", []) ?? [];

    // 函数白名单在 UI 中按一行一个 "相对路径:函数名/签名" 展示
    const funcLines: string[] = [];
    for (const [file, funcs] of Object.entries(funcWhitelistObj)) {
      if (!Array.isArray(funcs)) {
        continue;
      }
      for (const fn of funcs) {
        if (file === "*") {
          // 全局函数白名单在 UI 中仅展示函数名
          funcLines.push(fn);
        } else {
          funcLines.push(`${file}:${fn}`);
        }
      }
    }

    // 读取 AI 相关配置
    const aiEnabled = config.get<boolean>("enableAIRefactor", false);
    const aiEndpoint = config.get<string>("ai.endpoint", "");
    // API Key 从 SecretStorage 读取
    const aiApiKey = (await getApiKey()) || "";
    const aiModel = config.get<string>("ai.model", "gpt-4");
    const aiTemperature = config.get<number>("ai.temperature", 0.7);
    const aiTimeout = config.get<number>("ai.timeout", 60000);

    webview.postMessage({
      type: "initSettings",
      data: {
        checkMain,
        fileWhitelistText: fileWhitelistArray.join("\n"),
        funcWhitelistText: funcLines.join("\n"),
        returnTypeWhitelistText: returnTypeWhitelistArray.join("\n"),
        aiEnabled,
        aiEndpoint,
        aiApiKey,
        aiModel,
        aiTemperature,
        aiTimeout,
      },
    });

    // 检查工作区 .vscode/settings.json 状态，并输出提示信息
    let summary = "";
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      summary = "Doc-Doctor: 未找到工作区文件夹，将使用默认 Doc-Doctor 设置。";
    } else {
      const root = folders[0].uri;
      const settingsUri = vscode.Uri.joinPath(root, ".vscode", "settings.json");
      try {
        const data = await vscode.workspace.fs.readFile(settingsUri);
        const text = Buffer.from(data).toString("utf8").trim();
        if (!text) {
          summary =
            "Doc-Doctor: 当前工作区 .vscode/settings.json 为空，将使用默认 Doc-Doctor 设置。";
        } else {
          try {
            const json = JSON.parse(text) as Record<string, unknown>;
            const hasDocDoctorKey =
              "doc-doctor.checkMainFunction" in json ||
              "doc-doctor.fileWhitelist" in json ||
              "doc-doctor.functionWhitelist" in json ||
              "doc-doctor.returnTypeWhitelist" in json;

            if (hasDocDoctorKey) {
              summary =
                "Doc-Doctor: 已从 settings.json 读取配置:\n" +
                `- checkMainFunction: ${checkMain}\n` +
                `- fileWhitelist: ${
                  fileWhitelistArray.length > 0
                    ? fileWhitelistArray.join(", ")
                    : "(空)"
                }\n` +
                `- functionWhitelist: ${funcLines.length} 条\n` +
                `- returnTypeWhitelist: ${
                  returnTypeWhitelistArray.length > 0
                    ? returnTypeWhitelistArray.join(", ")
                    : "(空)"
                }`;
            } else {
              summary =
                "Doc-Doctor: 当前 settings.json 中未找到 Doc-Doctor 配置，使用默认值或全局设置。";
            }
          } catch {
            summary =
              "Doc-Doctor: 检测到 .vscode/settings.json 语法错误，将使用默认 Doc-Doctor 设置。请修复 settings.json 后重试。";
          }
        }
      } catch {
        summary =
          "Doc-Doctor: 当前工作区没有 .vscode/settings.json，将使用默认 Doc-Doctor 设置。";
      }
    }

    if (summary) {
      webview.postMessage({ type: "log", message: summary });
    }
  }

  /**
   * VS Code 配置发生变化时调用，重新推送最新设置到 Webview
   */
  public async onConfigurationChanged() {
    if (this._currentWebview) {
      await this.postCurrentSettings(this._currentWebview);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // 使用外部脚本文件 + nonce，避免 CSP 拦截脚本执行
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "sidebar.js")
    );
    // 引入 VS Code Webview UI Toolkit
    // 优先尝试本地文件（如果已下载），也可以保留 CDN 作为备选（需要 CSP 支持）
    // 这里我们假设会在 media 目录下放置 toolkit.js
    // 如果没有本地文件，暂时使用 CDN 链接（需调整 CSP）
    const toolkitUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "toolkit.js")
    );

    const nonce = `${Date.now()}${Math.random().toString().slice(2)}`;
    const cspSource = webview.cspSource;

    // 本项目已内置本地 toolkit.js，因此 CSP 不需要放开外网域名
    return `<!DOCTYPE html>
      <html lang="zh-cn">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https:; script-src 'nonce-${nonce}' ${cspSource}; style-src 'unsafe-inline' ${cspSource};" />
        <title>doc-doctor</title>
        <script type="module" src="${toolkitUri}"></script>
        <style>
          * {
            box-sizing: border-box;
          }
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          body {
            padding: 0;
            font-family: var(--vscode-font-family);
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          vscode-panels {
            width: 100%;
            flex: 1;
            min-height: 0;
            box-sizing: border-box;
            display: block;
          }
          /* 确保标签栏与内容区域左侧对齐 */
          /* 尝试多种选择器以确保兼容性 */
          vscode-panels::part(tabs),
          vscode-panels > :first-child,
          vscode-panels [role="tablist"],
          vscode-panels .tabs {
            padding-left: 16px;
            box-sizing: border-box;
          }
          /* 如果标签栏容器选择器不生效，直接调整第一个标签 */
          vscode-panel-tab:first-child {
            margin-left: 16px;
          }
          /* 覆盖一些基础样式以适应 toolkit */
          .container {
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding: 16px;
            width: 100%;
            box-sizing: border-box;
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
          }
          vscode-panel-view {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            overflow: hidden;
          }
          vscode-panel-view[hidden] {
            display: none !important;
          }
          vscode-panel-tab {
            white-space: nowrap;
            padding: 0 8px;
            cursor: pointer;
            border-bottom: none !important;
            text-decoration: none !important;
            transition: color 0.2s ease, font-weight 0.2s ease, background-color 0.2s ease;
          }
          /* 移除所有标签的下划线 */
          vscode-panel-tab::before,
          vscode-panel-tab::after {
            display: none !important;
            border-bottom: none !important;
          }
          /* 活动标签：使用颜色和字体粗细突出显示 */
          vscode-panel-tab[aria-selected="true"],
          vscode-panel-tab.active {
            color: var(--vscode-panelTitle-activeForeground, var(--vscode-foreground)) !important;
            font-weight: 600 !important;
            background-color: var(--vscode-list-activeSelectionBackground, transparent);
            border-bottom: none !important;
          }
          /* 非活动标签：使用较淡的颜色 */
          vscode-panel-tab:not([aria-selected="true"]):not(.active) {
            color: var(--vscode-panelTitle-inactiveForeground, var(--vscode-descriptionForeground)) !important;
            font-weight: 400 !important;
            opacity: 0.7;
          }
          /* 悬停效果 */
          vscode-panel-tab:hover {
            color: var(--vscode-panelTitle-activeForeground, var(--vscode-foreground)) !important;
            opacity: 1;
          }
          .filters {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
            margin-bottom: 8px;
            width: 100%;
          }
          .filters vscode-text-field {
            flex: 1 1 180px;
            min-width: 120px;
            width: 100%;
            max-width: 100%;
          }
          .filters vscode-dropdown {
            flex: 0 0 auto;
            min-width: 120px;
          }
          /* 窄屏时过滤器优化 */
          @media (min-width: 400px) and (max-width: 600px) {
            .filters {
              gap: 12px;
            }
            .filters vscode-text-field {
              min-width: 150px;
            }
            .filters vscode-dropdown {
              min-width: 130px;
            }
          }
          /* 宽屏时过滤器间距更大 */
          @media (min-width: 700px) {
            .filters {
              gap: 14px;
            }
            .filters vscode-text-field {
              min-width: 200px;
            }
            .filters vscode-dropdown {
              min-width: 140px;
            }
          }
          #problem-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 12px;
            margin-top: 12px;
            max-height: 600px;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 4px;
            width: 100%;
            box-sizing: border-box;
          }
          /* 响应式设计 - 根据侧边栏宽度自适应 */
          /* 超窄屏：单列布局 */
          @media (max-width: 320px) {
            #problem-list {
              grid-template-columns: 1fr;
              gap: 10px;
            }
          }
          /* 窄屏：单列或两列 */
          @media (min-width: 321px) and (max-width: 500px) {
            #problem-list {
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 10px;
            }
          }
          /* 中等宽度：2-3列 */
          @media (min-width: 501px) and (max-width: 700px) {
            #problem-list {
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              gap: 12px;
            }
          }
          /* 较宽：3-4列 */
          @media (min-width: 701px) and (max-width: 900px) {
            #problem-list {
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 14px;
            }
          }
          /* 宽屏：4列以上 */
          @media (min-width: 901px) {
            #problem-list {
              grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
              gap: 16px;
            }
          }
          /* 过滤器响应式 */
          @media (max-width: 500px) {
            .filters {
              flex-direction: column;
              align-items: stretch;
            }
            .filters vscode-text-field,
            .filters vscode-dropdown {
              width: 100%;
              min-width: unset;
            }
          }
          .problem-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            position: relative;
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
            min-height: 100px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
            box-sizing: border-box;
            align-items: stretch;
          }
          /* 宽屏时卡片内边距更大 */
          @media (min-width: 500px) {
            .problem-card {
              padding: 16px;
              min-height: 120px;
              gap: 10px;
            }
          }
          .problem-card:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0,0,0,0.2);
          }
          .problem-card.completed {
            opacity: 0.6;
            order: 999;
          }
          .problem-card.completed .badge {
            background: var(--vscode-testing-iconPassed, #4caf50);
          }
          .mark-btn {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 1px solid var(--vscode-widget-border);
            background: var(--vscode-editor-background);
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: opacity 0.2s ease, background 0.2s ease, transform 0.2s ease;
            z-index: 10;
          }
          .mark-btn:hover {
            opacity: 1;
            background: var(--vscode-button-secondaryBackground);
            transform: scale(1.1);
          }
          .problem-card.completed .mark-btn {
            background: var(--vscode-testing-iconPassed, #4caf50);
            color: #fff;
            opacity: 1;
            border-color: var(--vscode-testing-iconPassed, #4caf50);
          }
          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            padding-right: 36px;
            width: 100%;
          }
          .card-header > div:first-child {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-weight: 500;
            font-size: 14px;
          }
          .badge {
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 12px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            flex: 0 0 auto;
            white-space: nowrap;
            font-weight: 500;
            margin-left: auto;
          }
          .filename {
            font-size: 12px;
            opacity: 0.75;
            word-break: break-all;
            word-wrap: break-word;
            margin-top: 0;
            line-height: 1.5;
            width: 100%;
            overflow-wrap: break-word;
            hyphens: auto;
          }
          .desc {
            font-size: 13px;
            margin-top: 0;
            font-weight: 400;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            line-height: 1.6;
            color: var(--vscode-foreground);
            width: 100%;
            min-height: 0;
            word-break: break-word;
          }
          .ai-fix-btn {
            margin-top: auto;
            padding: 8px 12px;
            font-size: 12px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            cursor: pointer;
            width: 100%;
            transition: background 0.2s ease, transform 0.1s ease;
            font-weight: 500;
            box-sizing: border-box;
            display: block;
            flex-shrink: 0;
          }
          .ai-fix-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            transform: translateY(-1px);
          }
          .ai-fix-btn:active {
            transform: translateY(0);
          }
          .empty-state {
            text-align: center;
            opacity: 0.65;
            padding: 32px 16px;
            font-size: 13px;
            line-height: 1.6;
          }
          #output {
            padding: 12px;
            white-space: pre-wrap;
            font-size: 12px;
            max-height: 200px;
            overflow-y: auto;
            line-height: 1.6;
            border-radius: 4px;
            background: var(--vscode-textBlockQuote-background);
            box-sizing: border-box;
            width: 100%;
            margin: 0;
          }
          h3 {
            margin: 0 0 12px 0;
            font-size: 15px;
            font-weight: 600;
            opacity: 0.9;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
            width: 100%;
          }
          vscode-button {
            width: 100%;
            margin-bottom: 0;
            box-sizing: border-box;
          }
          vscode-text-field,
          vscode-text-area,
          vscode-dropdown {
            width: 100%;
            box-sizing: border-box;
          }
          /* 宽屏时按钮可并排 */
          .btn-row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 8px;
            width: 100%;
          }
          .btn-row vscode-button {
            flex: 1 1 140px;
            min-width: 120px;
            width: 100%;
            box-sizing: border-box;
          }
          /* 超窄屏：按钮单列 */
          @media (max-width: 350px) {
            .btn-row {
              flex-direction: column;
              gap: 8px;
            }
            .btn-row vscode-button {
              width: 100%;
              min-width: unset;
            }
          }
          /* 窄屏：按钮可并排但间距更小 */
          @media (min-width: 351px) and (max-width: 500px) {
            .btn-row {
              gap: 8px;
            }
            .btn-row vscode-button {
              min-width: 100px;
            }
          }
          /* 宽屏：按钮间距更大 */
          @media (min-width: 600px) {
            .btn-row {
              gap: 12px;
            }
            .btn-row vscode-button {
              min-width: 140px;
            }
          }
          vscode-divider {
            margin: 20px 0;
          }
          vscode-checkbox {
            margin: 8px 0;
            display: flex;
            align-items: center;
          }
          vscode-text-area {
            margin: 8px 0 16px 0;
          }
          p {
            margin: 0 0 12px 0;
            line-height: 1.5;
          }
          /* 宽屏时设置区域双列 */
          @media (min-width: 500px) {
            .settings-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .settings-grid .full-width {
              grid-column: 1 / -1;
            }
          }
          /* 滚动条样式优化 */
          #problem-list::-webkit-scrollbar,
          #output::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          #problem-list::-webkit-scrollbar-track,
          #output::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
          }
          #problem-list::-webkit-scrollbar-thumb,
          #output::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 4px;
          }
          #problem-list::-webkit-scrollbar-thumb:hover,
          #output::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-activeBackground);
          }
        </style>
      </head>
      <body>
        <vscode-panels activeid="tab-1" style="width: 100%;">
            <vscode-panel-tab id="tab-1">检查</vscode-panel-tab>
            <vscode-panel-tab id="tab-2">设置</vscode-panel-tab>
            <vscode-panel-tab id="tab-3">调试</vscode-panel-tab>
            
            <!-- 检查页 -->
            <vscode-panel-view id="view-1">
                <div class="container">
                    <h3>核心检查</h3>
                    <div class="btn-row">
                      <vscode-button id="run-check" appearance="secondary">检查单个文件</vscode-button>
                      <vscode-button id="run-project-check" appearance="primary">检查整个项目</vscode-button>
                    </div>
                    <vscode-button id="cancel-check" appearance="secondary" style="display:none;">取消检查</vscode-button>

                    <vscode-divider></vscode-divider>

                    <h3>问题展示区</h3>
                    <div class="filters">
                      <vscode-text-field id="search-input" placeholder="搜索文件/函数..." style="flex:1"></vscode-text-field>
                      <vscode-dropdown id="type-filter" style="min-width: 110px;">
                        <vscode-option value="all">所有类型</vscode-option>
                        <vscode-option value="1">参数缺失</vscode-option>
                        <vscode-option value="2">返回值缺失</vscode-option>
                        <vscode-option value="3">说明缺失</vscode-option>
                        <vscode-option value="4">变更警告</vscode-option>
                        <vscode-option value="5">语法错误</vscode-option>
                      </vscode-dropdown>
                    </div>
                    <div id="problem-list">
                      <div class="empty-state">点击"检查整个项目"开始扫描，发现的问题会显示在这里</div>
                    </div>
                </div>
            </vscode-panel-view>
            
            <!-- 设置页 -->
            <vscode-panel-view id="view-2">
                <div class="container">
                    <h3>检查规则</h3>
                    <vscode-checkbox id="setting-check-main">检查 main 函数</vscode-checkbox>
                    
                    <vscode-divider></vscode-divider>
                    
                    <h3>文件白名单</h3>
                    <p style="font-size:12px;opacity:0.75;margin:0 0 12px 0;line-height:1.5;">每行一个路径，支持目录（如 test/）</p>
                    <vscode-text-area id="setting-file-whitelist" rows="5" placeholder="test/&#10;src/legacy/&#10;vendor/" resize="vertical"></vscode-text-area>
                    
                    <vscode-divider></vscode-divider>
                    
                    <h3>函数白名单</h3>
                    <p style="font-size:12px;opacity:0.75;margin:0 0 12px 0;line-height:1.5;">每行一个函数名</p>
                    <vscode-text-area id="setting-func-whitelist" rows="4" placeholder="init&#10;cleanup" resize="vertical"></vscode-text-area>

                    <vscode-divider></vscode-divider>

                    <h3>返回值类型白名单</h3>
                    <p style="font-size:12px;opacity:0.75;margin:0 0 12px 0;line-height:1.5;">每行一个返回值类型，例如 void、int 等</p>
                    <vscode-text-area id="setting-returntype-whitelist" rows="4" placeholder="void" resize="vertical"></vscode-text-area>
                    
                    <vscode-divider></vscode-divider>
                    
                    <h3>AI 修复配置</h3>
                    <vscode-checkbox id="setting-ai-enable">启用 AI 修复注释功能</vscode-checkbox>
                    <p style="font-size:12px;opacity:0.75;margin:8px 0 12px 0;line-height:1.5;">启用后可在问题卡片上使用 AI 生成或更新注释</p>
                    
                    <p style="font-size:13px;font-weight:500;margin:16px 0 8px 0;">API 接口地址</p>
                    <vscode-text-field id="setting-ai-endpoint" placeholder="https://api.openai.com/v1/chat/completions"></vscode-text-field>
                    <p style="font-size:12px;opacity:0.75;margin:4px 0 12px 0;line-height:1.5;">AI 服务的 HTTP 接口地址（OpenAI 或兼容接口）</p>
                    
                    <p style="font-size:13px;font-weight:500;margin:8px 0 8px 0;">API Key</p>
                    <vscode-text-field id="setting-ai-apikey" type="password" placeholder="sk-..."></vscode-text-field>
                    <p style="font-size:12px;opacity:0.75;margin:4px 0 12px 0;line-height:1.5;">调用 AI 服务使用的 API Key</p>
                    
                    <p style="font-size:13px;font-weight:500;margin:8px 0 8px 0;">模型名称</p>
                    <vscode-text-field id="setting-ai-model" placeholder="gpt-4"></vscode-text-field>
                    <p style="font-size:12px;opacity:0.75;margin:4px 0 12px 0;line-height:1.5;">例如：gpt-4, gpt-4-turbo-preview, gpt-3.5-turbo 等</p>
                    
                    <p style="font-size:13px;font-weight:500;margin:8px 0 8px 0;">温度参数 (0-2)</p>
                    <vscode-text-field id="setting-ai-temperature" type="number" placeholder="0.7"></vscode-text-field>
                    <p style="font-size:12px;opacity:0.75;margin:4px 0 12px 0;line-height:1.5;">值越高越随机，值越低越确定（默认 0.7）</p>
                    
                    <p style="font-size:13px;font-weight:500;margin:8px 0 8px 0;">超时时间（毫秒）</p>
                    <vscode-text-field id="setting-ai-timeout" type="number" placeholder="60000"></vscode-text-field>
                    <p style="font-size:12px;opacity:0.75;margin:4px 0 12px 0;line-height:1.5;">AI API 请求超时时间（默认 60000，即 60 秒）</p>
                    
                    <vscode-button id="save-settings" appearance="primary" style="margin-top:16px;">保存设置</vscode-button>
                </div>
            </vscode-panel-view>
            
            <!-- 调试页 -->
            <vscode-panel-view id="view-3">
                <div class="container">
                    <h3>跳转测试</h3>
                    <vscode-button id="test-jump" appearance="secondary">测试跳转到当前</vscode-button>
                    
                    <vscode-divider></vscode-divider>
                    
                    <h3>数据库测试</h3>
                    <div class="btn-row">
                      <vscode-button id="test-save-db" appearance="secondary">测试存储</vscode-button>
                      <vscode-button id="test-load-db" appearance="secondary">测试读取</vscode-button>
                    </div>
                    
                </div>
            </vscode-panel-view>
        </vscode-panels>
        
        <div style="padding: 16px; border-top: 1px solid var(--vscode-panel-border); flex-shrink: 0; box-sizing: border-box; width: 100%;">
          <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; opacity: 0.9; padding-bottom: 8px; border-bottom: 1px solid var(--vscode-panel-border);">输出日志</h3>
          <div id="output">准备就绪...</div>
        </div>
        
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

// 当你的扩展被激活时会调用此方法
// 你的扩展会在第一次执行命令时被激活
export function activate(context: vscode.ExtensionContext) {
  // 使用 console 输出诊断信息（console.log）和错误（console.error）
  // 这行代码只会在扩展被激活时执行一次
  console.log('Congratulations, your extension "doc-doctor" is now active!');

  // 初始化数据库模块（加载 C++ DLL）
  initDB(context.extensionUri);

  // 初始化 SecretStorage 模块（用于安全存储 API Key）
  initSecretStorage(context);

  // 该命令已在 package.json 文件中定义
  // 现在通过 registerCommand 提供命令的具体实现
  // commandId 参数必须与 package.json 中的 command 字段一致
  const disposable = vscode.commands.registerCommand(
    "doc-doctor.helloWorld",
    () => {
      // 你放在这里的代码会在每次命令被执行时运行
      // 向用户显示一个消息框
      vscode.window.showInformationMessage("Hello World from doc-doctor!");
    }
  );

  context.subscriptions.push(disposable);

  // 注册单文件检查命令，供前端/其他模块调用
  const checkSingleFileCommand = vscode.commands.registerCommand(
    "doc-doctor.checkSingleFile",
    async () => {
      await pickAndCheckFile();
    }
  );

  context.subscriptions.push(checkSingleFileCommand);

  // 注册侧边栏视图提供者
  const sidebarProvider = new DocDoctorSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DocDoctorSidebarProvider.viewType,
      sidebarProvider
    )
  );

  // 监听 Doc-Doctor 相关配置变更，实时刷新设置到侧边栏
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("doc-doctor")) {
        sidebarProvider.onConfigurationChanged();
      }
    })
  );
}

// 当你的扩展被释放（deactivate）时会调用此方法
export function deactivate() {}
