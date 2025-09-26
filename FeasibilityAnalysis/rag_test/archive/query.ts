// query.ts
import { FunctionIndexer } from "./indexer.js";

// 主查询函数
export async function queryFunctions() {
  const indexer = new FunctionIndexer();

  // 示例查询
  const queryCode = `
    int calculate(int x, int y) {
        return x * y;
    }
    `;

  console.log("查询函数相关性...");
  const results = await indexer.findSimilarFunctions(queryCode, 5);

  console.log("最相似的函数:");
  results.forEach((result, index) => {
    console.log(
      `${index + 1}. ${result.name} (相似度: ${result.similarity.toFixed(3)})`
    );
    console.log(`   文件: ${result.filePath}`);
    console.log(`   代码预览: ${result.code.substring(0, 100)}...`);
    console.log();
  });
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  queryFunctions().catch(console.error);
}
