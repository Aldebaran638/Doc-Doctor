// indexer.ts
import fs from "fs/promises";
import path from "path";
import Parser from "tree-sitter";
// @ts-ignore
import Cpp from "tree-sitter-cpp";
import { pipeline } from "@xenova/transformers";
// 简化的索引器类
export class FunctionIndexer {
    functions = [];
    parser;
    extractor = null;
    constructor() {
        this.parser = new Parser();
        // @ts-ignore - tree-sitter-cpp 类型定义可能不完整
        this.parser.setLanguage(Cpp);
    }
    async initialize() {
        // 加载嵌入模型 (只会下载一次)
        this.extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
        console.log("模型加载完成");
    }
    async extractFunctions(filePath) {
        const code = await fs.readFile(filePath, "utf-8");
        const tree = this.parser.parse(code);
        const functions = [];
        // 简单的文本匹配方式，避免复杂的 tree-sitter 查询
        const functionRegex = /(\w+\s+\w+\s*\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g;
        const matches = code.match(functionRegex);
        if (matches) {
            for (const match of matches) {
                // 提取函数名
                const nameMatch = match.match(/(\w+)\s*\(/);
                if (nameMatch && nameMatch[1]) {
                    const functionName = nameMatch[1];
                    functions.push({ name: functionName, code: match });
                }
            }
        }
        return functions;
    }
    async indexProject(projectPath) {
        console.log("开始索引项目...");
        if (!this.extractor) {
            await this.initialize();
        }
        const files = await this.getAllFiles(projectPath, [".cpp", ".h", ".hpp"]);
        for (const file of files) {
            console.log(`处理文件: ${file}`);
            try {
                const functions = await this.extractFunctions(file);
                for (const func of functions) {
                    console.log(`处理函数: ${func.name}`);
                    // 生成向量嵌入
                    const result = await this.extractor(func.code, {
                        pooling: "mean",
                        normalize: true,
                    });
                    const embedding = Array.from(result.data);
                    this.functions.push({
                        name: func.name,
                        code: func.code,
                        filePath: file,
                        embedding: embedding,
                    });
                }
            }
            catch (error) {
                console.error(`处理文件 ${file} 时出错:`, error);
            }
        }
        // 保存索引
        await this.saveIndex();
        console.log(`索引完成！共索引了 ${this.functions.length} 个函数。`);
    }
    async getAllFiles(dir, extensions) {
        const files = [];
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    const subFiles = await this.getAllFiles(fullPath, extensions);
                    files.push(...subFiles);
                }
                else if (item.isFile() &&
                    extensions.some((ext) => item.name.endsWith(ext))) {
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
            console.error(`读取目录 ${dir} 时出错:`, error);
        }
        return files;
    }
    async saveIndex() {
        const indexData = {
            functions: this.functions.map((f) => ({
                name: f.name,
                filePath: f.filePath,
                embedding: f.embedding,
                code: f.code,
            })),
        };
        await fs.writeFile("functions-index.json", JSON.stringify(indexData, null, 2));
    }
    async findSimilarFunctions(queryFunction, topK = 5) {
        if (!this.extractor) {
            await this.initialize();
        }
        // 加载已保存的索引
        await this.loadIndex();
        // 生成查询向量
        const result = await this.extractor(queryFunction, {
            pooling: "mean",
            normalize: true,
        });
        const queryEmbedding = Array.from(result.data);
        // 计算相似度
        const similarities = this.functions.map((func) => ({
            ...func,
            similarity: this.cosineSimilarity(queryEmbedding, func.embedding || []),
        }));
        // 排序并返回前 K 个
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }
    async loadIndex() {
        try {
            const data = await fs.readFile("functions-index.json", "utf-8");
            const indexData = JSON.parse(data);
            this.functions = indexData.functions;
        }
        catch (error) {
            console.error("加载索引失败:", error);
            this.functions = [];
        }
    }
    cosineSimilarity(a, b) {
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
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
// 示例用法
export async function main() {
    const indexer = new FunctionIndexer();
    // 索引项目
    // await indexer.indexProject('path/to/your/cpp/project');
    // 查询相似函数
    const queryCode = `
    int add(int a, int b) {
        return a + b;
    }
    `;
    const similar = await indexer.findSimilarFunctions(queryCode, 5);
    console.log("相似函数:");
    console.table(similar.map((s) => ({
        name: s.name,
        file: path.basename(s.filePath),
        similarity: s.similarity.toFixed(3),
    })));
}
// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
//# sourceMappingURL=indexer.js.map