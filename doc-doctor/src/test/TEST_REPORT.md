# Doc-Doctor 测试报告

**报告版本**：1.0  
**执行日期**：2025-12-31  
**执行人**：Richard Liu

---

## 1. 测试范围

- 自动化测试：冒烟、单元、功能、集成、回归用例
- 手工测试：验收用例

---

## 2. 测试环境

- OS：Windows（本地执行）
- Node.js：22.x
- VS Code 测试版本：1.107.1
- 运行方式：`npm test`

---

## 3. 执行结果汇总

| 指标 | 结果 |
|---|---|
| 自动化用例总数 | 47 |
| 通过 | 47 |
| 失败 | 0 |
| 跳过 | 0 |

---

## 4. 备注与环境提示

1. `npm test` 过程中 eslint 存在 2 条警告（`curly` 规则），不影响测试结果。
2. VS Code 测试日志出现 `Error mutex already exists`，未影响测试执行。
3. 数据库 DLL 位于 `D:\Coding\Doc-Doctor\doc-doctor\native\build\Release`，测试进程未从该路径加载，已自动回退到 Mock 模式，相关测试仍通过。
4. Git 变更检测未启用（测试环境无可用仓库），相关逻辑已自动跳过。
