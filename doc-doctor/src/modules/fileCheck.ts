import * as vscode from "vscode";

export interface FunctionInfo {
  filePath: string;
  functionName: string;
  functionSignature: string;
  comment: string;
  functionContent: string;
  lineNumber: number;
  columnNumber: number;
}

export interface ParseResult {
  success: boolean;
  functions: FunctionInfo[];
  errorCode?: string | null;
  error?: string | null;
}

/**
 * 核心文件检查函数：根据传入的 C/C++ 文件 URI 进行解析，并返回解析结果。
 */
export async function checkFile(uri: vscode.Uri): Promise<ParseResult> {
  const filePath = uri.fsPath;

  if (!filePath.endsWith(".c") && !filePath.endsWith(".cpp")) {
    return {
      success: false,
      functions: [],
      errorCode: "UNSUPPORTED_FILE_TYPE",
      error: "仅支持 .c / .cpp 文件",
    };
  }

  let content: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    content = Buffer.from(bytes).toString("utf8");
  } catch (err) {
    return {
      success: false,
      functions: [],
      errorCode: "READ_ERROR",
      error: (err as Error).message,
    };
  }

  // 解析函数定义并提取 Doxygen 注释
  const functions: FunctionInfo[] = [];
  const regex = /([\w\s\*]+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const fullMatch = match[0];
    const functionName = match[2];
    const functionSignature = match[0].replace("{", "").trim();

    const matchIndex = match.index;
    const textBefore = content.slice(0, matchIndex);
    const linesBefore = textBefore.split(/\r?\n/);
    const lineNumber = linesBefore.length;
    const columnNumber = linesBefore[linesBefore.length - 1].length + 1;

    // 提取函数前面的 Doxygen 注释（向上查找最近的 /** ... */ 块）
    const comment = extractCommentBeforeFunction(content, matchIndex);

    // 简单地将整行之后到第一个右花括号视为函数体片段（只用于展示）
    const rest = content.slice(matchIndex + fullMatch.length - 1);
    const endIndex = rest.indexOf("}");
    const functionBody = endIndex >= 0 ? rest.slice(0, endIndex + 1) : rest;

    const info: FunctionInfo = {
      filePath,
      functionName,
      functionSignature,
      comment,
      functionContent: functionBody,
      lineNumber,
      columnNumber,
    };

    functions.push(info);
  }

  return {
    success: true,
    functions,
    errorCode: null,
    error: null,
  };
}

/**
 * 提供给命令和 Webview 使用的封装：
 * - 弹出文件选择对话框，选择单个 C/C++ 文件并进行检查；
 * - 用 showInformationMessage 展示处理结果摘要；
 * - 如果传入了 webview，则把完整结果通过 postMessage 回传给前端。
 */
export async function pickAndCheckFile(
  webview?: vscode.Webview
): Promise<void> {
  const uri = await pickSingleCFile();
  if (!uri) {
    return;
  }

  const result = await checkFile(uri);
  const relativePath = vscode.workspace.asRelativePath(uri, false);

  if (!result.success) {
    vscode.window.showInformationMessage(
      `检查失败: ${relativePath} - ${result.errorCode ?? "UNKNOWN_ERROR"} ${
        result.error ? "(" + result.error + ")" : ""
      }`
    );

    if (webview) {
      webview.postMessage({
        type: "singleFileCheckResult",
        filePath: relativePath,
        result,
      });
    }
    return;
  }

  vscode.window.showInformationMessage(
    `检查完成: ${relativePath}，共解析到 ${result.functions.length} 个函数`
  );

  if (webview) {
    webview.postMessage({
      type: "singleFileCheckResult",
      filePath: relativePath,
      result,
    });
  }
}

async function pickSingleCFile(): Promise<vscode.Uri | undefined> {
  const result = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: "选择要检查的 C/C++ 文件",
    filters: {
      "C/C++ Files": ["c", "cpp"],
    },
  });

  if (!result || result.length === 0) {
    return undefined;
  }

  return result[0];
}

/**
 * 提取函数定义前的 Doxygen 注释
 * @param content 文件全部内容
 * @param functionStartIndex 函数定义开始位置
 * @returns 提取到的注释字符串，未找到则返回空字符串
 */
function extractCommentBeforeFunction(
  content: string,
  functionStartIndex: number
): string {
  const before = content.slice(0, functionStartIndex);
  // 匹配最后一个 /** ... */ 或 /* ... */ 注释块
  const commentRegex = /\/\*\*?([\s\S]*?)\*\//g;
  let lastComment = "";
  let match: RegExpExecArray | null;

  while ((match = commentRegex.exec(before)) !== null) {
    // 检查注释块与函数之间是否只有空白字符
    const afterComment = before.slice(
      match.index + match[0].length,
      functionStartIndex
    );
    if (/^\s*$/.test(afterComment)) {
      lastComment = match[0];
    }
  }

  return lastComment.trim();
}
