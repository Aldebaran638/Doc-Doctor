# C++ 函数相关性分析器 (RAG 技术演示) - 重构版

这是一个使用 RAG (Retrieval-Augmented Generation) 技术的 TypeScript 程序，提供两种不同的 C++ 函数相关性分析方案。

## 🎯 功能特性

- **双模式RAG**: 提供在线和离线两种RAG实现
- **统一接口**: 两个函数都接受字符串输入，返回相关函数数组
- **功能测试**: 完整的测试套件验证两种算法的效果
- **性能对比**: 自动测试并比较两种算法的性能差异

## 📁 项目结构

```
rag_test/
├── utils/                    # 核心RAG函数
│   ├── online-rag.ts        # 网络版本RAG (使用向量嵌入)
│   └── offline-rag.ts       # 离线版本RAG (使用文本相似度)
├── test.ts                  # 主测试文件
├── archive/                 # 旧版本文件存档
├── package.json             # 项目配置
└── README.md               # 项目文档
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译项目

```bash
npm run build
```

### 3. 运行测试

```bash
# 运行完整测试
node -e "import('./dist/test.js').then(m => m.runTests())"

# 仅测试离线版本
node -e "import('./dist/utils/offline-rag.js').then(m => console.log(m.findRelatedFunctionsOffline('int add(int a, int b) { return a + b; }')))"
```

## � API 使用说明

### 离线版本 RAG 函数

```typescript
import { findRelatedFunctionsOffline, OfflineRelatedFunction } from "./utils/offline-rag.js";

/**
 * @param inputFunction - 输入的C++函数字符串
 * @param topK - 返回最相关的前K个函数，默认为5
 * @returns OfflineRelatedFunction[] - 相关函数数组
 */
const results = findRelatedFunctionsOffline(`
int sum(int x, int y) {
    return x + y;
}
`, 3);
```

### 网络版本 RAG 函数

```typescript
import { findRelatedFunctionsOnline, RelatedFunction } from "./utils/online-rag.js";

/**
 * @param inputFunction - 输入的C++函数字符串  
 * @param topK - 返回最相关的前K个函数，默认为5
 * @returns Promise<RelatedFunction[]> - 相关函数数组
 */
const results = await findRelatedFunctionsOnline(`
int multiply(int a, int b) {
    return a * b;
}
`, 3);
```

## 📊 测试结果示例

```
🚀 开始RAG函数功能测试
============================================================

📝 测试函数: addition
输入函数:
int sum(int x, int y) {
    return x + y;
}
----------------------------------------
� 离线版本结果 (耗时: 1ms):
   1. add (相似度: 0.000)
      文件: math.cpp
      代码: int add(int a, int b) { return a + b; }...
   2. subtract (相似度: 0.000)  
      文件: math.cpp
      代码: int subtract(int x, int y) { return x - y; }...

🌐 网络版本结果 (耗时: 2847ms):
   1. add (相似度: 0.892)
      文件: math.cpp  
      代码: int add(int a, int b) { return a + b; }...
   2. sum_array (相似度: 0.754)
      文件: algorithms.cpp
      代码: int sum_array(int numbers[], int count) { ... }...
```

## 🔍 算法对比

| 特性 | 离线版本 | 网络版本 |
|------|----------|----------|
| **算法** | Jaccard 相似度 | 余弦相似度 (向量嵌入) |
| **网络依赖** | ❌ 无 | ✅ 需要 (首次) |
| **启动速度** | ⚡ 极快 | 🐌 较慢 |
| **准确性** | 📊 基础 | 🏆 高精度 |
| **语义理解** | ❌ 仅词汇 | ✅ 深度语义 |
| **资源消耗** | 💡 极低 | 🔥 较高 |

## 💡 核心技术

### 离线版本 (`offline-rag.ts`)
- **文本预处理**: 移除注释、提取关键词
- **Jaccard 相似度**: 基于词汇集合的重叠度计算
- **关键词过滤**: 过滤通用编程关键字

### 网络版本 (`online-rag.ts`)
- **向量嵌入**: 使用 `all-MiniLM-L6-v2` 模型
- **余弦相似度**: 在高维向量空间中计算相似度
- **语义理解**: 理解代码的深层含义而非仅仅词汇

## 🎯 应用场景

1. **代码重构辅助**: 找出功能相似需要合并的函数
2. **API 发现**: 在大型代码库中发现相关功能
3. **文档同步检查**: 验证函数修改后相关文档是否需要更新
4. **代码审查**: 识别潜在的重复实现

## 🚧 扩展方向

- 支持更多编程语言（Python、JavaScript等）
- 集成到 VS Code 插件中
- 添加函数调用关系分析
- 实现增量索引更新

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License