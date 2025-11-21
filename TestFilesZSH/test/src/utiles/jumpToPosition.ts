import * as vscode from "vscode";
import * as path from "path";

/**
 * @description 跳转光标到指定文件的指定位置
 * @param filePath 文件路径
 * @param line 行号
 * @param column 列号
 * @returns {void}
 */
export default async function jumpToPosition(
  filePath: string,
  line: number,
  column: number
): Promise<void> {
  try {
    // 将相对路径解析为绝对路径并转换为 VS Code 的 URI
    const absolutePath = path.resolve(__dirname, filePath);
    const fileUri = vscode.Uri.file(absolutePath);

    // 打开文件
    const document = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(document);

    // 创建位置对象
    const position = new vscode.Position(line, column);

    // 创建新的选区并设置光标位置
    const newSelection = new vscode.Selection(position, position);
    editor.selection = newSelection;

    // 滚动到光标位置
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );
  } catch (error) {
    console.error("跳转到指定位置时出错:", error);
    console.error("当前路径:", __dirname);
    vscode.window.showErrorMessage(
      `无法跳转到文件 ${filePath} 的第 ${line + 1} 行，第 ${column + 1} 列。`
    );
  }
}
