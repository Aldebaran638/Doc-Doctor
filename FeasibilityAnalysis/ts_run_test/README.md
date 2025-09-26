# TS项目的运行方式

## 前置工作

### 初始化项目

```bash
npm init -y
```

### 安装TS工具tsc

tsc是TS文件的编译工具。它会根据指定tsconfig配置文件，将TS文件翻译为JS文件
```bash
# 安装tsc工具
npm install -g typescript

# 检查tsc是否安装成功
tsc --version
```

## 编译

### 使用tsc翻译TS文件

```bash
# 创建tsconfig配置文件
tsc --init

# 这句指令会寻找当前目录下的tsconfig.json，并编译tsconfig.json指定的所有文件（由配置文件中include参数指定）。如果没有找到tsconfig.json，那就使用默认配置
tsc

# 这句指令会编译main.ts文件以及与这个文件相关的其他ts文件，但是会忽略当前目录下的tsconfig.json
tsc main.ts

# 这句指令会编译tsconfig.json指定的所有文件（由配置文件中include参数指定）及与这个文件相关的其他ts文件。-p参数告诉tsc，应该参考哪个目录下的配置文件进行编译。
tsc -p ./ --include main.ts
```

### VSCode自动化编译TS文件
见网址同标题下的内容即可[VSCode运行TS文件](https://blog.csdn.net/qq_41579104/article/details/129066204)

### tsconfig.json内容建议

```json
/* 将TS文件翻译成JS文件以后，JS文件存放的地方 */
"outDir": "./dist",

/* 在现代TS项目中这样设置比较好，否则用不了export和import这样的关键字。 */
/* 这样的设置可以确保TS使用的是ES模块而不是比较老的CommonJS模块 */
"module": "ESNext",
"target": "ES2022",
```

## 运行

### 使用Code Runner运行ts代码

Code Runner原理就是，在特定文件点击右上小三角后，Code Runner会在终端中执行特定的指令。
在设置中搜索“Code Runner”找到“Executor Map”选项，然后点击“在setting.json中设置”。
里面的内容类似这样：
```json
{
  "code-runner.executorMap": {
    "typescript": "ts-node"
  },
  "code-runner.runInTerminal": true
}
```

其中，
```json
{
  "code-runner.executorMap": {
    "typescript": "ts-node"
  },
}
```
代表的就是当用户在ts文件中启动Code Runner的时候，Code Runner会执行`ts-node {当前文件文件名}`指令

而
```json
{
  "code-runner.runInTerminal": true
}
```
代表指令在终端执行，而不是“输出”窗口。

在当前项目的`.vscode/settings.json`文件中配置上述内容而不是在设置中修改Code Runner的配置，可以让上述内容只在当前文件夹生效




