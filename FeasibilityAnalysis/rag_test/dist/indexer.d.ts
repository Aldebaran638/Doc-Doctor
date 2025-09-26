export declare class FunctionIndexer {
    private functions;
    private parser;
    private extractor;
    constructor();
    initialize(): Promise<void>;
    extractFunctions(filePath: string): Promise<{
        name: string;
        code: string;
    }[]>;
    indexProject(projectPath: string): Promise<void>;
    private getAllFiles;
    private saveIndex;
    findSimilarFunctions(queryFunction: string, topK?: number): Promise<{
        similarity: number;
        name: string;
        code: string;
        filePath: string;
        embedding?: number[];
    }[]>;
    private loadIndex;
    private cosineSimilarity;
}
export declare function main(): Promise<void>;
//# sourceMappingURL=indexer.d.ts.map