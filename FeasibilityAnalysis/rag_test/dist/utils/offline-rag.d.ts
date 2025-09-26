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
export declare function findRelatedFunctionsOffline(inputFunction: string, topK?: number): OfflineRelatedFunction[];
//# sourceMappingURL=offline-rag.d.ts.map