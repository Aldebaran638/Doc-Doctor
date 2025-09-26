/**
 * 相关函数信息接口
 */
export interface RelatedFunction {
    name: string;
    code: string;
    filePath: string;
    similarity: number;
}
/**
 * 依赖网络的 RAG 函数，使用向量嵌入进行语义相似度分析
 * @param inputFunction - 输入的C++函数字符串
 * @param topK - 返回最相关的前K个函数，默认为5
 * @returns Promise<RelatedFunction[]> - 相关函数数组
 */
export declare function findRelatedFunctionsOnline(inputFunction: string, topK?: number): Promise<RelatedFunction[]>;
//# sourceMappingURL=online-rag.d.ts.map