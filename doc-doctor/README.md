# Doc-Doctor

**Doc-Doctor** 是一个 VS Code 扩展，用于检查 C/C++ 项目中函数的 Doxygen 注释完整性。

## ✨ 功能特性

- 🔍 **项目全量检查**：扫描工作区所有 `.c/.cpp` 文件，检测注释问题
- 📄 **单文件检查**：选择单个文件进行解析和检查
- 📋 **问题列表展示**：支持按类型筛选、关键词搜索
- 🎯 **一键跳转**：点击问题卡片，自动跳转到对应代码位置
- ✅ **状态管理**：标记问题为"已完成"，置底显示
- 💾 **数据持久化**：使用 SQLite 数据库存储检查结果
- ⚙️ **白名单配置**：支持配置文件/函数白名单（开发中）

## 🔧 检测的问题类型

| 类型 | 说明 |
|------|------|
| 参数缺失 | 函数参数缺少 `@param` 说明 |
| 返回值缺失 | 非 void 函数缺少 `@return` 说明 |
| 说明缺失 | 函数缺少 `@brief` 功能描述 |
| 变更警告 | 函数内容变更但注释未更新（规划中） |
| 语法错误 | 文件存在语法错误，无法解析 |

## 📦 安装

### 从源码安装

1. 克隆仓库：
   ```bash
   git clone <repository-url>
   cd Doc-Doctor/doc-doctor
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 编译 C++ 数据库模块（可选，不编译则使用模拟数据）：
   ```bash
   # 需要安装 vcpkg 和相关依赖
   cd native/build
   cmake .. -DCMAKE_TOOLCHAIN_FILE=<vcpkg-path>/scripts/buildsystems/vcpkg.cmake
   cmake --build . --config Release
   ```

4. 编译 TypeScript：
   ```bash
   npm run compile
   ```

5. 按 `F5` 启动调试

### 依赖说明

**Node.js 依赖**（自动安装）：
- `koffi` - FFI 库，用于调用 C++ 动态库

**C++ 依赖**（编译 DLL 时需要）：
- SQLite3
- nlohmann/json

## 🚀 使用方法

1. 打开 VS Code，在 Activity Bar 中点击 **Doc-Doctor** 图标
2. 在侧边栏中：
   - 点击 **"检查整个项目"** 扫描所有 C/C++ 文件
   - 点击 **"检查单个文件"** 选择特定文件检查
3. 查看问题列表：
   - 使用搜索框过滤问题
   - 使用下拉框按类型筛选
   - 点击问题卡片跳转到代码位置
   - 点击右上角 ○ 标记问题为已完成

## 📁 项目结构

```
doc-doctor/
├── src/
│   ├── extension.ts          # 扩展入口
│   └── modules/
│       ├── fileCheck.ts      # 文件解析模块
│       ├── functionCheck.ts  # 函数检查模块
│       ├── projectCheck.ts   # 项目检查模块
│       ├── jumpToLocation.ts # 跳转模块
│       └── database.ts       # 数据库桥接层
├── media/
│   ├── sidebar.js            # 前端交互逻辑
│   ├── toolkit.js            # VS Code Webview UI Toolkit
│   └── icon.svg              # 扩展图标
├── native/
│   ├── src/
│   │   ├── database.h        # C++ 头文件
│   │   ├── database.cpp      # C++ 实现
│   │   └── main.cpp          # 测试程序
│   ├── CMakeLists.txt        # CMake 配置
│   └── build/                # 编译输出
└── package.json
```

## ⚙️ 配置项（开发中）

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `doc-doctor.checkMainFunction` | boolean | false | 是否检查 main 函数 |
| `doc-doctor.fileWhitelist` | string[] | [] | 文件白名单（支持目录） |
| `doc-doctor.functionWhitelist` | string[] | [] | 函数白名单 |

## 🛠️ 开发

### 编译

```bash
npm run compile   # 编译一次
npm run watch     # 监听模式
```

### 调试

1. 在 VS Code 中打开 `doc-doctor` 目录
2. 按 `F5` 启动 Extension Development Host
3. 在新窗口中测试扩展

### C++ 模块编译

参见 [native/README.md](native/README.md)

## 📝 注释规范

本扩展检测 **Doxygen 风格** 的注释：

```c
/**
 * @brief 计算两个整数的和
 * @param a 第一个加数
 * @param b 第二个加数
 * @return 两数之和
 */
int add(int a, int b) {
    return a + b;
}
```

## 🐛 已知问题

- 暂不支持 C++ 模板函数的解析
- 宏定义的函数可能无法正确识别
- 匿名函数不在检查范围内


