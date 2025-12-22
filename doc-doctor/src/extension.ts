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
    // 空白内容
    webviewView.webview.html = this.getHtmlForWebview();
  }

  private getHtmlForWebview(): string {
    return `<!DOCTYPE html>
      <html lang="zh-cn">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>doc-doctor</title>
      </head>
      <body>
      </body>
      </html>`;
  }
}


// 模块 'vscode' 包含了 VS Code 的扩展 API
// 导入该模块，并在下方代码中用 vscode 作为别名引用
import * as vscode from "vscode";

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
