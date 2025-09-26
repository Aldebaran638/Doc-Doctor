// offline-rag.ts - 不依赖网络的 RAG 函数
export interface OfflineRelatedFunction {
  name: string;
  code: string;
  filePath: string;
  similarity: number;
}

/**
 * 不依赖网络的 RAG 函数，使用文本相似度分析
 * @param inputFunction - 输入的C++函数字符串
 * @param topK - 返回最相关的前K个函数，默认为5
 * @returns OfflineRelatedFunction[] - 相关函数数组
 */
export function findRelatedFunctionsOffline(
  inputFunction: string,
  topK: number = 5
): OfflineRelatedFunction[] {
  console.log("🔌 使用离线版本RAG分析...");

  try {
    // 模拟项目中的函数数据库
    const mockFunctions = getMockFunctionDatabase();

    // 计算与所有候选函数的相似度
    const similarities: OfflineRelatedFunction[] = [];

    for (const func of mockFunctions) {
      const similarity = calculateTextSimilarity(inputFunction, func.code);

      similarities.push({
        name: func.name,
        code: func.code,
        filePath: func.filePath,
        similarity: similarity,
      });
    }

    // 按相似度降序排序，返回前topK个
    const result = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    console.log("✅ 离线版本RAG分析完成");
    return result;
  } catch (error) {
    console.error("❌ 离线版本RAG分析失败:", error);
    throw error;
  }
}

/**
 * 计算文本相似度（改进版，考虑多种相似度指标）
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  // 1. 基于关键词的Jaccard相似度
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  const jaccardSimilarity =
    union.size === 0 ? 0 : intersection.size / union.size;

  // 2. 基于所有词汇（包括关键字）的相似度
  const allWords1 = extractAllWords(text1);
  const allWords2 = extractAllWords(text2);

  const allSet1 = new Set(allWords1);
  const allSet2 = new Set(allWords2);

  const allIntersection = new Set([...allSet1].filter((x) => allSet2.has(x)));
  const allUnion = new Set([...allSet1, ...allSet2]);

  const allWordsSimilarity =
    allUnion.size === 0 ? 0 : allIntersection.size / allUnion.size;

  // 3. 结构相似度（函数签名）
  const structureSimilarity = calculateStructureSimilarity(text1, text2);

  // 加权组合三种相似度
  return (
    jaccardSimilarity * 0.3 +
    allWordsSimilarity * 0.5 +
    structureSimilarity * 0.2
  );
}

/**
 * 提取所有单词（包括被过滤的关键字）
 */
function extractAllWords(code: string): string[] {
  const cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

  return cleanCode.match(/\b[a-z_][a-z0-9_]*\b/g) || [];
}

/**
 * 计算结构相似度（参数个数、返回类型等）
 */
function calculateStructureSimilarity(code1: string, code2: string): number {
  // 提取函数签名特征
  const getSignatureFeatures = (code: string) => {
    const features = {
      returnType: "",
      paramCount: 0,
      hasArray: false,
      hasPointer: false,
    };

    // 提取返回类型
    const returnTypeMatch = code.match(/^\\s*(\\w+)\\s+\\w+/);
    if (returnTypeMatch && returnTypeMatch[1]) {
      features.returnType = returnTypeMatch[1].toLowerCase();
    }

    // 计算参数个数
    const paramMatch = code.match(/\\(([^)]*)\\)/);
    if (paramMatch && paramMatch[1] && paramMatch[1].trim()) {
      features.paramCount = paramMatch[1].split(",").length;
    }

    // 检查是否有数组或指针
    features.hasArray = code.includes("[") && code.includes("]");
    features.hasPointer = code.includes("*");

    return features;
  };

  const features1 = getSignatureFeatures(code1);
  const features2 = getSignatureFeatures(code2);

  let similarity = 0;
  let totalFeatures = 4;

  // 返回类型相同
  if (features1.returnType === features2.returnType) similarity += 1;

  // 参数个数相同
  if (features1.paramCount === features2.paramCount) similarity += 1;

  // 数组特征相同
  if (features1.hasArray === features2.hasArray) similarity += 1;

  // 指针特征相同
  if (features1.hasPointer === features2.hasPointer) similarity += 1;

  return similarity / totalFeatures;
}

/**
 * 从代码中提取关键词
 */
function extractKeywords(code: string): string[] {
  // 移除注释和多余空格
  const cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, "") // 移除块注释
    .replace(/\/\/.*$/gm, "") // 移除行注释
    .replace(/\s+/g, " ") // 合并空格
    .toLowerCase();

  // 提取标识符和关键字
  const keywords = cleanCode.match(/\b[a-z_][a-z0-9_]*\b/g) || [];

  // 过滤掉过于通用的词汇
  const commonWords = new Set([
    "int",
    "void",
    "char",
    "double",
    "float",
    "const",
    "return",
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "break",
    "continue",
    "true",
    "false",
    "null",
    "this",
    "new",
    "delete",
  ]);

  return keywords.filter((word) => !commonWords.has(word) && word.length > 1);
}

/**
 * 获取模拟的函数数据库
 */
function getMockFunctionDatabase(): Array<{
  name: string;
  code: string;
  filePath: string;
}> {
  return [
    {
      name: "add",
      code: `int add(int a, int b) {
    return a + b;
}`,
      filePath: "math.cpp",
    },
    {
      name: "subtract",
      code: `int subtract(int x, int y) {
    return x - y;
}`,
      filePath: "math.cpp",
    },
    {
      name: "multiply",
      code: `int multiply(int first, int second) {
    return first * second;
}`,
      filePath: "math.cpp",
    },
    {
      name: "calculate_area",
      code: `double calculate_area(double width, double height) {
    return width * height;
}`,
      filePath: "geometry.cpp",
    },
    {
      name: "string_length",
      code: `int string_length(const char* str) {
    int length = 0;
    while (str[length] != '\\0') {
        length++;
    }
    return length;
}`,
      filePath: "string_utils.cpp",
    },
    {
      name: "copy_string",
      code: `void copy_string(char* destination, const char* source) {
    int index = 0;
    while (source[index] != '\\0') {
        destination[index] = source[index];
        index++;
    }
    destination[index] = '\\0';
}`,
      filePath: "string_utils.cpp",
    },
    {
      name: "find_maximum",
      code: `int find_maximum(int array[], int size) {
    int maximum = array[0];
    for (int i = 1; i < size; i++) {
        if (array[i] > maximum) {
            maximum = array[i];
        }
    }
    return maximum;
}`,
      filePath: "algorithms.cpp",
    },
    {
      name: "sum_numbers",
      code: `int sum_numbers(int numbers[], int count) {
    int total = 0;
    for (int i = 0; i < count; i++) {
        total += numbers[i];
    }
    return total;
}`,
      filePath: "algorithms.cpp",
    },
  ];
}
