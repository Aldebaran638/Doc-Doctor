import * as vscode from "vscode";
import { FunctionInfo } from "./fileCheck";

/**
 * Doc-Doctor 白名单相关配置结构
 *
 * 对应 settings.json 中的示例：
 * {
 *   "doc-doctor.checkMainFunction": false,
 *   "doc-doctor.functionWhitelist": {
 *     "src/file1.c": ["function1", "function2"],
 *     "src/file2.c": ["function3"]
 *   },
 *   "doc-doctor.fileWhitelist": [
 *     "src/legacy/",
 *     "test/"
 *   ],
 *   "doc-doctor.returnTypeWhitelist": ["void"]
 * }
 */
export interface DocDoctorSettings {
  checkMainFunction: boolean;
  functionWhitelist: Record<string, string[]>;
  fileWhitelist: string[];
  returnTypeWhitelist: string[];
}

function getConfig() {
  return vscode.workspace.getConfiguration("doc-doctor");
}

/**
 * 读取并规范化 Doc-Doctor 相关设置
 */
export function getDocDoctorSettings(): DocDoctorSettings {
  const config = getConfig();

  const checkMainFunction = config.get<boolean>("checkMainFunction", false);

  const functionWhitelistRaw = config.get<unknown>("functionWhitelist", {});
  const functionWhitelist: Record<string, string[]> =
    normalizeFunctionWhitelist(functionWhitelistRaw);

  const fileWhitelist = config.get<string[]>("fileWhitelist", []) ?? [];
  const returnTypeWhitelist =
    config.get<string[]>("returnTypeWhitelist", []) ?? [];

  return {
    checkMainFunction,
    functionWhitelist,
    fileWhitelist,
    returnTypeWhitelist,
  };
}

function normalizeFunctionWhitelist(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const src = value as Record<string, unknown>;
  const result: Record<string, string[]> = {};

  for (const [file, funcs] of Object.entries(src)) {
    if (Array.isArray(funcs)) {
      const list = funcs
        .map((f) => String(f).trim())
        .filter((f) => f.length > 0);
      if (list.length > 0) {
        result[file] = list;
      }
    }
  }

  return result;
}

/**
 * 计算相对路径（优先使用工作区相对路径）
 */
function getRelativePath(filePath: string): string {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    return filePath.replace(/\\/g, "/");
  }
  const uri = vscode.Uri.file(filePath);
  const rel = vscode.workspace.asRelativePath(uri, false);
  return rel.replace(/\\/g, "/");
}

/**
 * 判断文件是否在白名单中（前缀匹配）
 */
export function isFileWhitelisted(
  filePath: string,
  settings: DocDoctorSettings
): boolean {
  const rel = getRelativePath(filePath);
  if (!settings.fileWhitelist || settings.fileWhitelist.length === 0) {
    return false;
  }

  return settings.fileWhitelist.some((prefix) => {
    const p = prefix.replace(/\\/g, "/");
    if (!p) return false;
    return rel.startsWith(p) || rel === p;
  });
}

/**
 * 判断单个函数是否在函数白名单中
 *
 * 为了避免同名函数干扰：优先使用函数签名匹配，其次才回退到函数名匹配。
 */
export function isFunctionWhitelisted(
  func: FunctionInfo,
  settings: DocDoctorSettings
): boolean {
  const rel = getRelativePath(func.filePath);

  // 1) 文件级白名单
  const perFileList = settings.functionWhitelist[rel];
  if (perFileList && perFileList.length > 0) {
    if (perFileList.includes(func.functionSignature)) {
      return true;
    }
    if (perFileList.includes(func.functionName)) {
      return true;
    }
  }

  // 2) 全局函数白名单（"*" 作为特殊 key）
  const globalList = settings.functionWhitelist["*"];
  if (globalList && globalList.length > 0) {
    if (globalList.includes(func.functionSignature)) {
      return true;
    }
    if (globalList.includes(func.functionName)) {
      return true;
    }
  }

  return false;
}

/**
 * 判断函数返回值类型是否在白名单中
 */
export function isReturnTypeWhitelisted(
  func: FunctionInfo,
  settings: DocDoctorSettings
): boolean {
  if (
    !settings.returnTypeWhitelist ||
    settings.returnTypeWhitelist.length === 0
  ) {
    return false;
  }

  const sig = func.functionSignature.trim();
  const parenIndex = sig.indexOf("(");
  if (parenIndex <= 0) {
    return false;
  }

  let beforeParen = sig.slice(0, parenIndex).trim();
  if (!beforeParen) {
    return false;
  }

  // 去掉末尾的函数名部分，仅保留返回值相关修饰和类型
  const funcName = func.functionName?.trim();
  if (funcName) {
    const idx = beforeParen.lastIndexOf(funcName);
    if (idx >= 0) {
      beforeParen = beforeParen.slice(0, idx).trim();
    }
  }

  if (!beforeParen) {
    return false;
  }

  // 去除修饰关键字和指针/引用符号，只保留基础类型词
  let cleaned = beforeParen
    // 删除常见修饰关键字
    .replace(/\b(static|const|inline|virtual|constexpr|friend|extern)\b/g, " ")
    // 删除连续的 * 和 &
    .replace(/[\*&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return false;
  }

  const parts = cleaned.split(/\s+/);
  const baseType = parts[parts.length - 1];

  return settings.returnTypeWhitelist.some((t) => {
    const tt = t.trim();
    if (!tt) return false;
    // 同时支持匹配基础类型（"void"）和完整类型串（"unsigned long"）
    return baseType === tt || cleaned === tt;
  });
}

/**
 * 是否应当跳过某个函数的检查（白名单逻辑统一入口）
 */
export function shouldSkipFunction(
  func: FunctionInfo,
  settings: DocDoctorSettings
): boolean {
  // 1. main 函数默认不检查，除非开启 checkMainFunction
  if (!settings.checkMainFunction) {
    if (func.functionName === "main") {
      return true;
    }
  }

  // 2. 按文件白名单过滤
  if (isFileWhitelisted(func.filePath, settings)) {
    return true;
  }

  // 3. 按函数白名单过滤（文件 + 函数签名/名称）
  if (isFunctionWhitelisted(func, settings)) {
    return true;
  }

  // 4. 按返回值类型白名单过滤
  if (isReturnTypeWhitelisted(func, settings)) {
    return true;
  }

  return false;
}
