# Doc-Doctor 测试文档

## 测试结构

```
src/test/
├── unit/              # 单元测试
│   ├── fileCheck.test.ts
│   ├── functionCheck.test.ts
│   ├── fileWhiteList.test.ts
│   └── jumpToLocation.test.ts
├── integration/       # 集成测试
│   ├── projectCheck.test.ts
│   └── database.test.ts
├── utils/             # 测试工具
│   └── testHelpers.ts
├── fixtures/          # 测试数据
│   └── testFiles.ts
└── extension.test.ts  # 扩展入口测试
```

## 运行测试

### 方式一：使用 VS Code 测试运行器

1. 安装 [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner) 扩展
2. 运行 `npm run compile` 编译 TypeScript
3. 在 VS Code 中打开测试视图（Activity Bar → Testing）
4. 点击运行按钮或使用快捷键 `Ctrl/Cmd + ; A`

### 方式二：使用命令行

```bash
# 编译代码
npm run compile

# 运行所有测试
npm test

# 运行单元测试（如果配置了 grep）
npm run test:unit

# 运行集成测试（如果配置了 grep）
npm run test:integration
```

## 测试覆盖范围

### 单元测试

#### fileCheck 模块
- ✅ 文件内容解析
- ✅ 函数提取
- ✅ 注释提取
- ✅ 位置计算（行号、列号）
- ✅ 文件类型验证
- ✅ 控制语句过滤
- ✅ 错误处理

#### functionCheck 模块
- ✅ 注释完整性检查
- ✅ @brief 缺失检测
- ✅ @param 缺失检测
- ✅ @return 缺失检测
- ✅ void 函数特殊处理
- ✅ 问题描述生成

#### fileWhiteList 模块
- ✅ 文件白名单匹配
- ✅ 函数白名单匹配（文件级、全局）
- ✅ 返回值类型白名单
- ✅ main 函数跳过逻辑
- ✅ 配置读取

#### jumpToLocation 模块
- ✅ 文件跳转
- ✅ 路径处理（绝对/相对）
- ✅ 错误处理

### 集成测试

#### projectCheck 模块
- ✅ 项目全量检查
- ✅ 文件统计
- ✅ 问题发现
- ✅ 取消机制
- ✅ 语法错误处理

#### database 模块
- ✅ 问题存储
- ✅ 问题加载
- ✅ 状态更新
- ✅ Mock 模式支持

## 测试数据

测试使用的 C/C++ 文件样本位于 `fixtures/testFiles.ts`，包含：

- 完整注释的函数
- 缺少各种注释标签的函数
- void 函数
- main 函数
- 多个函数的文件
- 指针参数函数
- 语法错误文件
- 空文件
- 控制语句文件

## 注意事项

1. **数据库测试**：如果 C++ DLL 不可用，测试会自动使用 mock 模式，所有测试仍应通过。

2. **文件系统测试**：部分测试需要创建临时文件，测试完成后会自动清理。

3. **VS Code API Mock**：某些测试可能需要真实的 VS Code 环境，在纯单元测试中可能需要 mock。

4. **异步测试**：使用 `async/await` 处理异步操作，注意正确处理 Promise。

## 添加新测试

1. 在相应的测试目录（`unit/` 或 `integration/`）创建新的测试文件
2. 使用 `suite()` 和 `test()` 组织测试用例
3. 使用 `assert` 进行断言
4. 使用 `testHelpers.ts` 中的工具函数简化测试代码
5. 在 `fixtures/testFiles.ts` 中添加新的测试数据（如需要）

## 持续集成

测试可以在 CI/CD 流程中运行：

```yaml
# 示例 GitHub Actions 配置
- name: Run tests
  run: |
    npm install
    npm run compile
    npm test
```

## 测试最佳实践

1. **独立性**：每个测试应该独立运行，不依赖其他测试的状态
2. **可重复性**：测试结果应该一致，不依赖外部环境
3. **清晰性**：测试名称应该清晰描述测试内容
4. **覆盖性**：优先覆盖核心功能和边界情况
5. **维护性**：使用辅助函数减少重复代码
