import { pipeline } from "@xenova/transformers";
/**
 * 依赖网络的 RAG 函数，使用向量嵌入进行语义相似度分析
 * @param inputFunction - 输入的C++函数字符串
 * @param topK - 返回最相关的前K个函数，默认为5
 * @returns Promise<RelatedFunction[]> - 相关函数数组
 */
export async function findRelatedFunctionsOnline(inputFunction, topK = 5) {
    console.log("🌐 使用网络版本RAG分析...");
    try {
        // 初始化嵌入模型
        const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
        console.log("✅ 模型加载完成");
        // 模拟项目中的函数数据库
        const mockFunctions = getMockFunctionDatabase();
        // 生成查询函数的向量嵌入
        const queryResult = await extractor(inputFunction, {
            pooling: "mean",
            normalize: true,
        });
        const queryEmbedding = Array.from(queryResult.data);
        // 为所有候选函数生成向量嵌入并计算相似度
        const similarities = [];
        for (const func of mockFunctions) {
            const funcResult = await extractor(func.code, {
                pooling: "mean",
                normalize: true,
            });
            const funcEmbedding = Array.from(funcResult.data);
            const similarity = cosineSimilarity(queryEmbedding, funcEmbedding);
            similarities.push({
                name: func.name,
                code: func.code,
                filePath: func.filePath,
                similarity: similarity,
            });
        }
        // 按相似度降序排序，返回前topK个
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }
    catch (error) {
        console.error("❌ 网络版本RAG分析失败:", error);
        throw error;
    }
}
/**
 * 计算余弦相似度
 */
function cosineSimilarity(a, b) {
    if (a.length !== b.length)
        return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        const aVal = a[i];
        const bVal = b[i];
        if (aVal !== undefined && bVal !== undefined) {
            dotProduct += aVal * bVal;
            normA += aVal * aVal;
            normB += bVal * bVal;
        }
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
}
/**
 * 获取模拟的函数数据库
 */
function getMockFunctionDatabase() {
    return [
        {
            name: "add",
            code: `int add(int a, int b) {
    return a + b;
}`,
            filePath: "math.cpp",
        },
        {
            name: "multiply",
            code: `int multiply(int x, int y) {
    return x * y;
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
    int len = 0;
    while (str[len] != '\\0') {
        len++;
    }
    return len;
}`,
            filePath: "string_utils.cpp",
        },
        {
            name: "find_max",
            code: `int find_max(int arr[], int size) {
    int max = arr[0];
    for (int i = 1; i < size; i++) {
        if (arr[i] > max) {
            max = arr[i];
        }
    }
    return max;
}`,
            filePath: "algorithms.cpp",
        },
        {
            name: "sum_array",
            code: `int sum_array(int numbers[], int count) {
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
//# sourceMappingURL=online-rag.js.map