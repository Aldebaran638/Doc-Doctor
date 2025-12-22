// 模块 'vscode' 包含了 VS Code 的扩展 API
// 导入该模块，并在下方代码中用 vscode 作为别名引用
import * as vscode from "vscode";
import { pickAndCheckFile } from "./modules/fileCheck";
import { runProjectCheck } from "./modules/projectCheck";
import { testJumpToLocation } from "./modules/jumpToLocation";
import { testSaveToDatabase, testLoadFromDatabase } from "./modules/database";

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
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message?.type) {
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
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // 使用外部脚本文件 + nonce，避免 CSP 拦截脚本执行
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "sidebar.js")
    );

    const nonce = `${Date.now()}${Math.random().toString().slice(2)}`;
    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
      <html lang="zh-cn">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https:; script-src 'nonce-${nonce}' ${cspSource}; style-src 'unsafe-inline' ${cspSource};" />
        <title>doc-doctor</title>
        <style>
          body {
            padding: 12px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", sans-serif;
          }
          button {
            padding: 8px 12px;
            margin: 4px 0;
            cursor: pointer;
            width: 100%;
            text-align: left;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          #output {
            margin-top: 12px;
            padding: 8px;
            white-space: pre-wrap;
            font-size: 12px;
            border-top: 1px solid var(--vscode-panel-border);
          }
          h3 {
            margin: 16px 0 8px 0;
            font-size: 14px;
            color: var(--vscode-foreground);
          }
        </style>
      </head>
      <body>
        <h3>文件语法解析模块</h3>
        <button id="run-check">1. 检查单个 C/C++ 文件</button>
        
        <h3>总检查模块</h3>
        <button id="run-project-check">2. 检查整个项目</button>
        
        <h3>工作区跳转模块</h3>
        <button id="test-jump">3. 测试跳转到当前位置</button>
        
        <h3>数据库模块</h3>
        <button id="test-save-db">4. 测试存储到数据库</button>
        <button id="test-load-db">5. 测试从数据库读取</button>
        
        <h3>输出区</h3>
        <div id="output">等待操作...</div>
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
