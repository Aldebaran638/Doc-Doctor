// 模块 'vscode' 包含了 VS Code 的扩展 API
// 导入该模块，并在下方代码中用 vscode 作为别名引用
import * as vscode from "vscode";
import { pickAndCheckFile } from "./modules/fileCheck";

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

    // 监听来自 Webview 的消息，用于触发文件检查命令
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === "runSingleFileCheck") {
        // 直接调用服务层封装，并把 webview 传入，用于回传结果
        await pickAndCheckFile(webviewView.webview);
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
            padding: 6px 12px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <button id="run-check">检查单个 C/C++ 文件</button>
        <div id="output"></div>
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
