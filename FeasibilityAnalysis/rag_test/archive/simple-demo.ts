// simple-demo.ts
// 不依赖网络的简化版本演示
import * as fs from "fs/promises";
import * as path from "path";

interface FunctionInfo {
  name: string;
  code: string;
  filePath: string;
  similarity?: number;
}

class SimpleFunctionAnalyzer {
  private functions: FunctionInfo[] = [];

  // 简单的文本相似度计算（不使用向量嵌入）
  private textSimilarity(text1: string, text2: string): number {
    // 将文本转换为词集合
    const words1 = new Set(text1.toLowerCase().match(/\w+/g) || []);
    const words2 = new Set(text2.toLowerCase().match(/\w+/g) || []);

    // 计算交集和并集
    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    // Jaccard 相似度
    return intersection.size / union.size;
  }

  // 从代码文本中提取函数
  extractFunctions(code: string, filePath: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    // 简单的 C++ 函数匹配正则表达式
    const functionRegex =
      /(\w+\s+\w+\s*\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g;
    let match;

    while ((match = functionRegex.exec(code)) !== null) {
      if (match[1]) {
        // 提取函数名
        const nameMatch = match[1].match(/(\w+)\s*\(/);
        if (nameMatch && nameMatch[1]) {
          functions.push({
            name: nameMatch[1],
            code: match[1],
            filePath: filePath,
          });
        }
      }
    }

    return functions;
  }

  // 模拟索引项目
  async simulateIndexProject() {
    console.log("🔍 模拟索引 C++ 项目...");

    // 模拟一些 C++ 代码示例
    const mockCppFiles = [
      {
        path: "math.cpp",
        code: `
                int add(int a, int b) {
                    return a + b;
                }
                
                int multiply(int x, int y) {
                    return x * y;
                }
                
                double calculate_area(double width, double height) {
                    return width * height;
                }
                `,
      },
      {
        path: "string_utils.cpp",
        code: `
                int string_length(const char* str) {
                    int len = 0;
                    while (str[len] != '\\0') {
                        len++;
                    }
                    return len;
                }
                
                void copy_string(char* dest, const char* src) {
                    int i = 0;
                    while (src[i] != '\\0') {
                        dest[i] = src[i];
                        i++;
                    }
                    dest[i] = '\\0';
                }
                `,
      },
      {
        path: "algorithms.cpp",
        code: `
                int find_max(int arr[], int size) {
                    int max = arr[0];
                    for (int i = 1; i < size; i++) {
                        if (arr[i] > max) {
                            max = arr[i];
                        }
                    }
                    return max;
                }
                
                void bubble_sort(int arr[], int n) {
                    for (int i = 0; i < n-1; i++) {
                        for (int j = 0; j < n-i-1; j++) {
                            if (arr[j] > arr[j+1]) {
                                int temp = arr[j];
                                arr[j] = arr[j+1];
                                arr[j+1] = temp;
                            }
                        }
                    }
                }
                `,
      },
    ];

    // 提取所有函数
    this.functions = [];
    for (const file of mockCppFiles) {
      const fileFunctions = this.extractFunctions(file.code, file.path);
      this.functions.push(...fileFunctions);
    }

    console.log(`✅ 索引完成！找到 ${this.functions.length} 个函数:`);
    this.functions.forEach((f) =>
      console.log(`   - ${f.name} (${f.filePath})`)
    );
  }

  // 查找相似函数
  findSimilarFunctions(queryCode: string, topK: number = 5): FunctionInfo[] {
    console.log("🔎 搜索相似函数...");

    // 计算与每个函数的相似度
    const results = this.functions.map((func) => ({
      ...func,
      similarity: this.textSimilarity(queryCode, func.code),
    }));

    // 排序并返回前 K 个
    return results
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, topK);
  }
}

// 演示功能
async function demo() {
  console.log("🚀 RAG 技术演示：函数相关性分析");
  console.log("=".repeat(50));

  const analyzer = new SimpleFunctionAnalyzer();

  // 1. 索引项目
  await analyzer.simulateIndexProject();

  console.log("\\n" + "=".repeat(50));

  // 2. 查询相似函数
  const queryFunction = `
    int sum(int x, int y) {
        return x + y;
    }
    `;

  console.log("📝 查询函数:");
  console.log(queryFunction);

  const similarFunctions = analyzer.findSimilarFunctions(queryFunction, 3);

  console.log("🎯 最相似的函数:");
  similarFunctions.forEach((func, index) => {
    console.log(`\\n${index + 1}. 函数: ${func.name}`);
    console.log(`   文件: ${func.filePath}`);
    console.log(`   相似度: ${(func.similarity || 0).toFixed(3)}`);
    console.log(`   代码预览: ${func.code.substring(0, 80)}...`);
  });

  console.log("\\n" + "=".repeat(50));
  console.log("💡 这就是 RAG 的核心思想:");
  console.log("   1. 索引阶段：提取和存储代码函数");
  console.log("   2. 检索阶段：找到最相关的函数");
  console.log("   3. 在真实应用中，会使用向量嵌入和更复杂的相似度计算");
}

// 运行演示
demo().catch(console.error);
