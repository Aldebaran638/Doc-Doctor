import * as vscode from "vscode";

/**
 * 工作区跳转模块
 *
 * 输入：文件路径、行号、列号
 * 输出：无（直接跳转工作区光标）
 */

/**
 * 跳转到指定文件的指定位置
 *
 * @param filePath - 文件路径（相对路径或绝对路径）
 * @param lineNumber - 行号（从 1 开始）
 * @param columnNumber - 列号（从 1 开始）
 * @returns 是否跳转成功
 */
export async function jumpToLocation(
  filePath: string,
  lineNumber: number,
  columnNumber: number,
  functionName?: string
): Promise<boolean> {
  try {
    // 尝试将相对路径转换为 URI
    let fileUri: vscode.Uri | undefined;

    // 如果是绝对路径，直接转换
    if (filePath.startsWith("/") || filePath.match(/^[a-zA-Z]:/)) {
      fileUri = vscode.Uri.file(filePath);
    } else {
      // 相对路径，需要在工作区中查找
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
      }
    }

    if (!fileUri) {
      vscode.window.showErrorMessage(`未找到文件: ${filePath}`);
      return false;
    }

    // 检查文件是否存在
    try {
      await vscode.workspace.fs.stat(fileUri);
    } catch (err) {
      vscode.window.showErrorMessage(`文件不存在: ${filePath}`);
      return false;
    }

    // 打开文档
    const document = await vscode.workspace.openTextDocument(fileUri);

    // 显示文档
    const editor = await vscode.window.showTextDocument(document);

    // 基于传入的行号（1-based）得到一个初始行（0-based）
    let targetLine = Math.max(0, lineNumber - 1);

    // 如果提供了函数名，则在目标行附近小范围搜索真正的函数定义行
    if (functionName && functionName.trim().length > 0) {
      const name = functionName.trim();
      const totalLines = document.lineCount;
      const start = Math.max(0, targetLine - 5);
      const end = Math.min(totalLines - 1, targetLine + 5);

      for (let i = start; i <= end; i++) {
        const text = document.lineAt(i).text;
        if (text.includes(name) && text.includes("(")) {
          targetLine = i;
          break;
        }
      }
    }

    // 定位到函数定义这一行的行首（或第一个非空白字符）
    const lineText = document.lineAt(targetLine).text;
    const firstNonWhite = lineText.search(/\S|$/);
    const position = new vscode.Position(
      targetLine,
      Math.max(0, firstNonWhite)
    );

    // 移动光标到指定位置
    editor.selection = new vscode.Selection(position, position);

    // 滚动视图使光标位置可见（居中显示）
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );

    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`跳转失败: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 提供给命令使用的封装：测试跳转功能
 *
 * @param webview - 可选的 webview 实例，用于回传结果
 */
export async function testJumpToLocation(
  webview?: vscode.Webview
): Promise<void> {
  // 获取当前活动编辑器
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showInformationMessage("请先打开一个文件");
    return;
  }

  const document = editor.document;
  const position = editor.selection.active;

  // 获取相对路径
  const relativePath = vscode.workspace.asRelativePath(document.uri, false);

  // 跳转到当前光标位置（演示功能）
  const lineNumber = position.line + 1;
  const columnNumber = position.character + 1;

  vscode.window.showInformationMessage(
    `将跳转到: ${relativePath} (行 ${lineNumber}, 列 ${columnNumber})`
  );

  const success = await jumpToLocation(relativePath, lineNumber, columnNumber);

  if (webview) {
    webview.postMessage({
      type: "jumpToLocationResult",
      success,
      filePath: relativePath,
      lineNumber,
      columnNumber,
    });
  }
}
