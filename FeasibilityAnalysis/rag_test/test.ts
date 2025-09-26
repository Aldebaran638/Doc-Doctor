// test.ts - 测试两种RAG函数的功能
import { findRelatedFunctionsOnline, RelatedFunction } from "./utils/online-rag.js";
import { findRelatedFunctionsOffline, OfflineRelatedFunction } from "./utils/offline-rag.js";

/**
 * 测试用的C++函数示例
 */
const testFunctions = {
    addition: `int sum(int x, int y) {
    return x + y;
}`,
    
    stringProcessing: `int get_length(const char* text) {
    int len = 0;
    while (text[len] != '\\0') {
        len++;
    }
    return len;
}`,
    
    arrayOperation: `int calculate_total(int values[], int size) {
    int result = 0;
    for (int i = 0; i < size; i++) {
        result += values[i];
    }
    return result;
}`
};

/**
 * 主测试函数
 */
async function runTests() {
    console.log("🚀 开始RAG函数功能测试");
    console.log("=" .repeat(60));
    
    // 测试每个示例函数
    for (const [testName, testFunction] of Object.entries(testFunctions)) {
        console.log(`\\n📝 测试函数: ${testName}`);
        console.log("输入函数:");
        console.log(testFunction);
        console.log("-" .repeat(40));
        
        // 测试离线版本
        await testOfflineRag(testFunction);
        
        console.log();
        
        // 测试网络版本
        await testOnlineRag(testFunction);
        
        console.log("=" .repeat(60));
    }
    
    console.log("\\n✨ 测试完成！");
}

/**
 * 测试离线版本RAG
 */
async function testOfflineRag(inputFunction: string) {
    try {
        const startTime = Date.now();
        const results = findRelatedFunctionsOffline(inputFunction, 3);
        const endTime = Date.now();
        
        console.log(`🔌 离线版本结果 (耗时: ${endTime - startTime}ms):`);
        
        if (results.length === 0) {
            console.log("   未找到相关函数");
        } else {
            results.forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.name} (相似度: ${result.similarity.toFixed(3)})`);
                console.log(`      文件: ${result.filePath}`);
                console.log(`      代码: ${result.code.replace(/\\n/g, ' ').substring(0, 80)}...`);
            });
        }
        
    } catch (error) {
        console.error("❌ 离线版本测试失败:", error);
    }
}

/**
 * 测试网络版本RAG
 */
async function testOnlineRag(inputFunction: string) {
    try {
        const startTime = Date.now();
        const results = await findRelatedFunctionsOnline(inputFunction, 3);
        const endTime = Date.now();
        
        console.log(`🌐 网络版本结果 (耗时: ${endTime - startTime}ms):`);
        
        if (results.length === 0) {
            console.log("   未找到相关函数");
        } else {
            results.forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.name} (相似度: ${result.similarity.toFixed(3)})`);
                console.log(`      文件: ${result.filePath}`);
                console.log(`      代码: ${result.code.replace(/\\n/g, ' ').substring(0, 80)}...`);
            });
        }
        
    } catch (error) {
        console.error("❌ 网络版本测试失败:", error);
        console.log("💡 可能是网络问题，请检查网络连接");
    }
}

/**
 * 性能对比测试
 */
async function performanceComparison() {
    console.log("\\n⚡ 性能对比测试");
    console.log("-" .repeat(30));
    
    const testFunction = testFunctions.addition;
    const iterations = 5;
    
    // 测试离线版本性能
    let offlineTotalTime = 0;
    for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        findRelatedFunctionsOffline(testFunction);
        const endTime = Date.now();
        offlineTotalTime += (endTime - startTime);
    }
    const offlineAvgTime = offlineTotalTime / iterations;
    
    // 测试网络版本性能（如果可用）
    let onlineAvgTime = 0;
    try {
        let onlineTotalTime = 0;
        for (let i = 0; i < iterations; i++) {
            const startTime = Date.now();
            await findRelatedFunctionsOnline(testFunction);
            const endTime = Date.now();
            onlineTotalTime += (endTime - startTime);
        }
        onlineAvgTime = onlineTotalTime / iterations;
    } catch (error) {
        console.log("网络版本性能测试跳过（网络不可用）");
    }
    
    console.log(`离线版本平均耗时: ${offlineAvgTime.toFixed(2)}ms`);
    if (onlineAvgTime > 0) {
        console.log(`网络版本平均耗时: ${onlineAvgTime.toFixed(2)}ms`);
        console.log(`性能差异: ${(onlineAvgTime / offlineAvgTime).toFixed(2)}x`);
    }
}

// 运行测试
async function main() {
    await runTests();
    await performanceComparison();
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { runTests, performanceComparison };