import * as vscode from "vscode";
import { FunctionInfo } from "./fileCheck";

/**
 * 函数检查模块
 *
 * 输入：FunctionInfo - 包含函数信息（函数名、签名、注释、内容等）
 * 输出：ProblemInfo[] - 该函数存在的注释问题列表
 */

/** 问题类型枚举 */
export enum ProblemType {
  PARAM_MISSING = 1, // 参数说明缺失
  RETURN_MISSING = 2, // 返回值说明缺失
  BRIEF_MISSING = 3, // 函数体说明缺失
  CONTENT_CHANGED = 4, // 内容变更警告
  SYNTAX_ERROR = 5, // 语法错误
}

/** 单个问题信息 */
export interface ProblemInfo {
  problemType: ProblemType;
  filePath: string;
  functionName: string;
  functionSignature: string;
  lineNumber: number;
  columnNumber: number;
  problemDescription: string;
  functionSnippet: string;
}

/**
 * 检查单个函数的注释完整性
 *
 * @param functionInfo - 函数信息
 * @returns 问题列表，如果无问题则返回空数组
 */
export function checkFunction(functionInfo: FunctionInfo): ProblemInfo[] {
  const problems: ProblemInfo[] = [];
  const {
    comment,
    functionSignature,
    filePath,
    functionName,
    lineNumber,
    columnNumber,
    functionContent,
  } = functionInfo;

  // 提取函数签名中的参数列表
  const params = extractParameters(functionSignature);

  // 判断函数是否有返回值（简化判断：非 void 类型）
  const hasReturnValue = !functionSignature.trim().startsWith("void ");

  // 检查是否有 @brief 或功能描述
  if (!hasDoxygenBrief(comment)) {
    problems.push({
      problemType: ProblemType.BRIEF_MISSING,
      filePath,
      functionName,
      functionSignature,
      lineNumber,
      columnNumber,
      problemDescription: "缺少函数功能描述（@brief）",
      functionSnippet: functionContent.slice(0, 200), // 只截取前 200 字符作为片段
    });
  }

  // 检查每个参数是否有 @param 说明
  for (const param of params) {
    if (!hasDoxygenParam(comment, param)) {
      problems.push({
        problemType: ProblemType.PARAM_MISSING,
        filePath,
        functionName,
        functionSignature,
        lineNumber,
        columnNumber,
        problemDescription: `缺少参数 "${param}" 的说明（@param ${param}）`,
        functionSnippet: functionContent.slice(0, 200),
      });
    }
  }

  // 检查返回值是否有 @return 说明
  if (hasReturnValue && !hasDoxygenReturn(comment)) {
    problems.push({
      problemType: ProblemType.RETURN_MISSING,
      filePath,
      functionName,
      functionSignature,
      lineNumber,
      columnNumber,
      problemDescription: "缺少返回值说明（@return）",
      functionSnippet: functionContent.slice(0, 200),
    });
  }

  return problems;
}

/**
 * 从函数签名中提取参数名列表
 * 例如：int add(int a, int b) => ['a', 'b']
 */
function extractParameters(signature: string): string[] {
  const params: string[] = [];

  // 提取括号内的参数部分
  const match = signature.match(/\(([^)]*)\)/);
  if (!match || !match[1].trim()) {
    return params;
  }

  const paramList = match[1].split(",");
  for (const param of paramList) {
    const trimmed = param.trim();
    if (!trimmed || trimmed === "void") {
      continue;
    }

    // 简单提取参数名（最后一个单词）
    const parts = trimmed.split(/\s+/);
    if (parts.length > 0) {
      let paramName = parts[parts.length - 1];
      // 去掉可能的指针符号
      paramName = paramName.replace(/[\*\&]/g, "");
      if (paramName) {
        params.push(paramName);
      }
    }
  }

  return params;
}

/**
 * 检查注释中是否有 @brief 或功能描述
 */
function hasDoxygenBrief(comment: string): boolean {
  if (!comment) {
    return false;
  }
  // 检查是否包含 @brief 标签，或者注释块中有非空内容
  return (
    /@brief\s+\S/.test(comment) ||
    comment.replace(/\/\*\*?|\*\/|\*/g, "").trim().length > 0
  );
}

/**
 * 检查注释中是否有指定参数的 @param 说明
 */
function hasDoxygenParam(comment: string, paramName: string): boolean {
  if (!comment) {
    return false;
  }
  const regex = new RegExp(`@param\\s+${paramName}\\s+\\S`, "i");
  return regex.test(comment);
}

/**
 * 检查注释中是否有 @return 说明
 */
function hasDoxygenReturn(comment: string): boolean {
  if (!comment) {
    return false;
  }
  return /@return\s+\S/.test(comment);
}
