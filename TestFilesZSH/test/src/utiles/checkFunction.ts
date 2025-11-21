/**
 * @brief 检查函数信息并返回问题相关信息
 * @param functionInfo 函数信息数组
 * 包含以下字段：
 *   - comment: string - 函数注释
 *   - returnType: string - 返回值类型
 *   - name: string - 函数名
 *   - parameters: string - 参数列表
 *   - line: number - 函数所在行
 *   - column: number - 函数所在列
 * @returns issues 函数问题数组，包含每个函数的问题信息对象
 * 返回值说明：
 *   - type: number - 问题类型编号.
 *   - - 0. 没有问题
 *   - - 1. 缺少 brief 注释
 *   - - 2. 缺少 param 注释
 *   - - 3. 缺少 return 注释
 *   - - 4. param 注释与参数不匹配
 *   - - 5. 函数内容变更警告(暂时不实现)
 *   - typeT: string - 问题类型描述(即以上编号对应的描述)
 *   - name: string - 函数名
 *   - message: string - 问题描述信息
 *   - line: number - 函数所在行
 *   - column: number - 函数所在列
 */
export default async function checkFunction(
  functionInfo: Array<{
    comment: string;
    returnType: string;
    name: string;
    parameters: string;
    line: number;
    column: number;
  }>
): Promise<
  Array<{
    type: number;
    typeT: string;
    name: string;
    message: string;
    line: number;
    column: number;
  }>
> {
  const issues: Array<{
    type: number;
    typeT: string;
    name: string;
    message: string;
    line: number;
    column: number;
  }> = [];

  functionInfo.forEach((func) => {
    const { comment, name, parameters, line, column } = func;

    // Split the comment into sections based on @param, @brief, and @returns
    const sections = comment.split(/\n\s*\*\s*@/);
    const paramSection = sections.find((section) =>
      section.startsWith("param")
    );
    const briefSection = sections.find((section) =>
      section.startsWith("brief")
    );
    const returnSection = sections.find((section) =>
      section.startsWith("returns")
    );

    // Check if @brief section is empty
    if (!briefSection || briefSection.trim() === "brief") {
      issues.push({
        type: 1,
        typeT: "缺少 brief 注释",
        name,
        message: "函数缺少 @brief 注释或内容为空",
        line,
        column,
      });
    }

    // Check if @param section is empty
    if (!paramSection || paramSection.trim() === "param") {
      issues.push({
        type: 2,
        typeT: "缺少 param 注释",
        name,
        message: "函数缺少 @param 注释或内容为空",
        line,
        column,
      });
    } else {
      // Check if parameters in @param match the function parameters
      const paramLines = paramSection.split("\n").slice(1); // Skip the first line
      const paramNames = parameters.split(",").map((p) => p.trim());
      const documentedParams = paramLines
        .map((line) => {
          const match = line.match(/-\s+(\w+)/);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      // Check for missing param annotations
      paramNames.forEach((param) => {
        if (!documentedParams.includes(param)) {
          issues.push({
            type: 4,
            typeT: "缺少参数注释",
            name,
            message: `参数 ${param} 缺少对应的 @param 注释`,
            line,
            column,
          });
        }
      });

      // Check for unmatched param annotations
      documentedParams.forEach((docParam) => {
        if (docParam && !paramNames.includes(docParam)) {
          issues.push({
            type: 4,
            typeT: "param 注释与参数不匹配",
            name,
            message: `@param 注释中的参数 ${docParam} 在函数定义中不存在`,
            line,
            column,
          });
        }
      });
    }

    // Check if @returns section is empty
    if (!returnSection || returnSection.trim() === "returns") {
      issues.push({
        type: 3,
        typeT: "缺少 return 注释",
        name,
        message: "函数缺少 @returns 注释或内容为空",
        line,
        column,
      });
    }
  });

  return issues;
}
