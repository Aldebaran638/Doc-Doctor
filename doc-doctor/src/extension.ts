// 模块 'vscode' 包含了 VS Code 的扩展 API
// 导入该模块，并在下方代码中用 vscode 作为别名引用
import * as vscode from "vscode";
import { pickAndCheckFile } from "./modules/fileCheck";
import { runProjectCheck } from "./modules/projectCheck";
import { jumpToLocation, testJumpToLocation } from "./modules/jumpToLocation";
import {
  testSaveToDatabase,
  testLoadFromDatabase,
  initDB,
} from "./modules/database";

// 注册侧边栏 WebviewViewProvider
class DocDoctorSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "doc-doctor.sidebarView";
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

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // 监听来自 Webview 的消息，用于触发各个模块的测试功能
    webviewView.webview.onDidReceiveMessage(async (message: any) => {
      switch (message?.type) {
        case "requestSettings": {
          // Webview 主动请求当前配置，用于初始化设置页
          this.postCurrentSettings(webviewView.webview);
          break;
        }
        case "runSingleFileCheck":
          await pickAndCheckFile(webviewView.webview);
          break;
        case "runProjectCheck":
          await runProjectCheck(webviewView.webview);
          break;
        case "testJumpToLocation":
          await testJumpToLocation(webviewView.webview);
          break;
        case "testSaveToDatabase":
          await testSaveToDatabase(webviewView.webview);
          break;
        case "testLoadFromDatabase":
          await testLoadFromDatabase(webviewView.webview);
          break;
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

              vscode.window.showInformationMessage("Doc-Doctor 设置已保存");

              webviewView.webview.postMessage({
                type: "settingsSaved",
                success: true,
              });

              // 可选：保存设置后自动重新检查整个项目
              await runProjectCheck(webviewView.webview);
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
          // TODO: 更新数据库中的问题状态
          const problemId = message?.data?.id;
          const status = message?.data?.status;
          console.log(
            `[Doc-Doctor] 更新问题状态: id=${problemId}, status=${status}`
          );
          // 当前仅返回成功，后续接入数据库
          webviewView.webview.postMessage({
            type: "problemStatusUpdated",
            data: { id: problemId, status: status, success: true },
          });
          break;
        }
        case "cancelCheck": {
          // TODO: 实现真正的取消逻辑（需要配合 projectCheck 模块）
          console.log("[Doc-Doctor] 用户请求取消检查");
          vscode.window.showInformationMessage("检查已取消");
          webviewView.webview.postMessage({ type: "checkCancelled" });
          break;
        }
      }
    });
  }

  /**
   * 将当前 doc-doctor 相关设置发送给 Webview，用于初始化设置页面
   */
  private postCurrentSettings(webview: vscode.Webview) {
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

    webview.postMessage({
      type: "initSettings",
      data: {
        checkMain,
        fileWhitelistText: fileWhitelistArray.join("\n"),
        funcWhitelistText: funcLines.join("\n"),
        returnTypeWhitelistText: returnTypeWhitelistArray.join("\n"),
      },
    });
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
          body {
            padding: 10px;
            font-family: var(--vscode-font-family);
          }
          /* 覆盖一些基础样式以适应 toolkit */
          .container {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .filters {
            display: flex;
            gap: 8px;
            align-items: center;
          }
          #problem-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 10px;
            max-height: 420px;
            overflow-y: auto;
          }
          .problem-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            position: relative;
          }
          .problem-card:hover {
            background: var(--vscode-list-hoverBackground);
          }
          .problem-card.completed {
            opacity: 0.5;
            order: 999;
          }
          .problem-card.completed .badge {
            background: var(--vscode-testing-iconPassed, #4caf50);
          }
          .mark-btn {
            position: absolute;
            top: 6px;
            right: 6px;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            border: 1px solid var(--vscode-widget-border);
            background: var(--vscode-editor-background);
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.6;
            transition: opacity 0.2s, background 0.2s;
          }
          .mark-btn:hover {
            opacity: 1;
            background: var(--vscode-button-secondaryBackground);
          }
          .problem-card.completed .mark-btn {
            background: var(--vscode-testing-iconPassed, #4caf50);
            color: #fff;
            opacity: 1;
          }
          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
          }
          .badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 999px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            flex: 0 0 auto;
          }
          .filename {
            font-size: 11px;
            opacity: 0.7;
            word-break: break-all;
            margin-top: 2px;
          }
          .desc {
            font-size: 12px;
            margin-top: 6px;
            font-weight: 500;
          }
          .empty-state {
            text-align: center;
            opacity: 0.65;
            padding: 18px 8px;
            font-size: 12px;
          }
          #output {
            margin-top: 12px;
            padding: 8px;
            white-space: pre-wrap;
            font-size: 12px;
            border-top: 1px solid var(--vscode-panel-border);
            max-height: 400px;
            overflow-y: auto;
          }
          h3 {
            margin: 10px 0 5px 0;
            font-size: 14px;
            opacity: 0.8;
          }
          vscode-button {
            width: 100%;
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <vscode-panels>
            <vscode-panel-tab id="tab-1">检查</vscode-panel-tab>
            <vscode-panel-tab id="tab-2">设置</vscode-panel-tab>
            <vscode-panel-tab id="tab-3">调试</vscode-panel-tab>
            
            <!-- 检查页 -->
            <vscode-panel-view id="view-1">
                <div class="container">
                    <h3>核心检查</h3>
                    <vscode-button id="run-check" appearance="secondary">检查单个文件</vscode-button>
                    <vscode-button id="run-project-check" appearance="primary">检查整个项目</vscode-button>
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
                    <p style="font-size:11px;opacity:0.7;margin:0 0 8px 0;">每行一个路径，支持目录（如 test/）</p>
                    <vscode-text-area id="setting-file-whitelist" rows="4" placeholder="test/&#10;src/legacy/&#10;vendor/" resize="vertical"></vscode-text-area>
                    
                    <vscode-divider></vscode-divider>
                    
                    <h3>函数白名单</h3>
                    <p style="font-size:11px;opacity:0.7;margin:0 0 8px 0;">每行一个函数名</p>
                    <vscode-text-area id="setting-func-whitelist" rows="3" placeholder="init&#10;cleanup" resize="vertical"></vscode-text-area>

                    <vscode-divider></vscode-divider>

                    <h3>返回值类型白名单</h3>
                    <p style="font-size:11px;opacity:0.7;margin:0 0 8px 0;">每行一个返回值类型，例如 void、int 等</p>
                    <vscode-text-area id="setting-returntype-whitelist" rows="3" placeholder="void" resize="vertical"></vscode-text-area>
                    
                    <vscode-button id="save-settings" appearance="primary" style="margin-top:12px;">保存设置</vscode-button>
                </div>
            </vscode-panel-view>
            
            <!-- 调试页 -->
            <vscode-panel-view id="view-3">
                <div class="container">
                    <h3>跳转测试</h3>
                    <vscode-button id="test-jump" appearance="secondary">测试跳转到当前</vscode-button>
                    
                    <vscode-divider></vscode-divider>
                    
                    <h3>数据库测试</h3>
                    <vscode-button id="test-save-db" appearance="secondary">测试存储</vscode-button>
                    <vscode-button id="test-load-db" appearance="secondary">测试读取</vscode-button>
                </div>
            </vscode-panel-view>
        </vscode-panels>

        <h3>输出日志</h3>
        <div id="output">准备就绪...</div>
        
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
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DocDoctorSidebarProvider.viewType,
      new DocDoctorSidebarProvider(context.extensionUri)
    )
  );
}

// 当你的扩展被释放（deactivate）时会调用此方法
export function deactivate() {}
