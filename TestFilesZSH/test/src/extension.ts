// 'vscode' 模块包含 VS Code 扩展性 API
// 导入该模块并在下面的代码中使用别名 vscode 引用它
import * as vscode from "vscode";
import readDirectory from "./utiles/readDirectory";
import analyseFile from "./utiles/analyseFile";
import jumpToPosition from "./utiles/jumpToPosition";
import checkFunction from "./utiles/checkFunction";
// 当您的扩展被激活时调用此方法
// 您的扩展在第一次执行命令时被激活

export function activate(context: vscode.ExtensionContext) {
  // 使用控制台输出诊断信息 (console.log) 和错误信息 (console.error)
  // 这行代码只在扩展激活时执行一次
  // 会输出在宿主的“调试控制台”和“扩展主机”ctrl+shift+I的终端中
  console.log('Congratulations, your extension "test" is now active!');

  // 命令已在 package.json 文件中定义
  // 现在使用 registerCommand 提供命令的实现
  // commandId 参数必须与 package.json 中的 command 字段匹配
  const disposable = vscode.commands.registerCommand("test.helloWorld", () => {
    // 您在这里放置的代码将在每次执行命令时运行
    // 向用户显示消息框
    vscode.window.showInformationMessage("Hello World from test!");
  });
  // 读取项目中的所有.c文件
  const disposable2 = vscode.commands.registerCommand(
    "test.readDirectory",
    readDirectory
  );
  const disposable3 = vscode.commands.registerCommand(
    "test.analyseFile",
    analyseFile("../../../math_utils.c")
  );
  const disposable4 = vscode.commands.registerCommand(
    "test.jumpToPosition",
    () => jumpToPosition("../../../math_utils.c", 7, 4)
  );
  const disposable5 = vscode.commands.registerCommand(
    "test.checkFunction",
    async () => {
      const mid = analyseFile("../../../math_utils.c");
      const functionInfo = mid();
      const issues = await checkFunction(functionInfo);
      console.log("函数检查结果:", issues);
    }
  );
  
  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
  context.subscriptions.push(disposable3);
  context.subscriptions.push(disposable4);
  context.subscriptions.push(disposable5);
}

// 当您的扩展被停用时调用此方法
export function deactivate() {}
