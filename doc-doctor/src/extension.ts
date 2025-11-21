// 'vscode' 模块包含 VS Code 扩展性 API
// 导入模块并在下面的代码中使用 vscode 别名引用它
import * as vscode from "vscode";
import * as gitExtension from "./git";
import { getDiff } from "./utils/getDiff";
import { getAddress } from "./utils/getAddress";
// 当你的扩展被激活时调用此方法
// 你的扩展在命令第一次执行时被激活
export function activate(context: vscode.ExtensionContext) {
  // 使用控制台输出诊断信息 (console.log) 和错误 (console.error)
  // 这行代码只会在你的扩展被激活时执行一次
  console.log('Congratulations, your extension "doc-doctor" is now active!');

  // 命令已在 package.json 文件中定义
  // 现在使用 registerCommand 提供命令的实现
  // commandId 参数必须与 package.json 中的 command 字段匹配
  const disposable = vscode.commands.registerCommand(
    "doc-doctor.helloWorld",
    () => {
      vscode.window.showInformationMessage("Hello World from doc-doctor!");
      const gitExtensionApi =
        vscode.extensions.getExtension<gitExtension.GitExtension>(
          "vscode.git"
        )?.exports;
      if (!gitExtensionApi) {
        vscode.window.showErrorMessage("未找到 Git 扩展");
        return;
      }
      const git = gitExtensionApi.getAPI(1); //获取Git API
      const repos = git.repositories; //获取所有仓库的列表
      const repo = repos[0]; // 默认取第一个仓库
      console.log(getAddress(gitExtensionApi.getAPI(1).repositories[0]));
    }
  );

  context.subscriptions.push(disposable);
}

// 当你的扩展被停用时调用此方法
export function deactivate() {}
