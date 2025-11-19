/**
 * 描述：用于提取单个文件中的函数信息的方法。返回列表之前美观地输出日志，日志内容为提取到的函数信息。
 * 参数1：文件路径（与当前文件呈相对路径）
 * 返回值：一个列表，用于存储提取到的函数信息（函数的注释（存储在函数上方）、函数返回值类型、函数名、函数参数、函数名所在行，函数名开头所在列）
 */

import * as fs from "fs";
import * as path from "path";

export default function curriedAnalyseFile(filePath: string) {
  return () => analyseFile(filePath); // 返回一个无参数的函数
}
function analyseFile(FilePath: string): Array<{
  comment: string;
  returnType: string;
  name: string;
  parameters: string;
  line: number;
  column: number;
}> {
  const Parser = require("tree-sitter");
  const C = require("tree-sitter-c");

  const parser = new Parser();
  parser.setLanguage(C);

  // 读取文件内容
  const absolutePath = path.resolve(__dirname, FilePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }
  const sourceCode = fs.readFileSync(absolutePath, "utf-8");

  // 解析代码
  const tree = parser.parse(sourceCode);
  const functions: Array<{
    comment: string;
    returnType: string;
    name: string;
    parameters: string;
    line: number;
    column: number;
  }> = [];

  // 遍历 AST 提取函数信息
  const visitNode = (node: any) => {
    if (node.type === "function_definition") {
      const nameNode = node.childForFieldName("declarator")?.firstChild;
      const returnTypeNode = node.childForFieldName("type");
      const parametersNode = nameNode?.nextSibling;

      if (nameNode && returnTypeNode) {
        // 提取函数上方的注释
        const commentNode = node.previousNamedSibling;
        const comment =
          commentNode && commentNode.type === "comment"
            ? commentNode.text.replace(/\/\//g, "").trim()
            : "";

        functions.push({
          comment,
          returnType: returnTypeNode.text,
          name: nameNode.text,
          parameters: parametersNode ? parametersNode.text : "",
          line: nameNode.startPosition.row + 1,
          column: nameNode.startPosition.column + 1,
        });
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      visitNode(node.child(i));
    }
  };

  visitNode(tree.rootNode);

  // 美观地输出日志
  console.log("提取到的函数信息:");
  functions.forEach((func) => {
    console.log(
      `函数名: ${func.name}, 返回值类型: ${func.returnType}, 参数: ${func.parameters}, 行: ${func.line}, 列: ${func.column}, 注释: ${func.comment}`
    );
  });

  return functions;
}
