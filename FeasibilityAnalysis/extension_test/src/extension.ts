// 模块 'vscode' 包含了 VS Code 的扩展 API
// 导入该模块，并在下面的代码中用 vscode 作为别名引用
import * as vscode from "vscode";
import * as gitExtension from "./git";
import { getDiff } from "./utils/getDiff";
import { getAddress } from "./utils/getAddress";
// 当你的扩展被激活时会调用此方法
// 你的扩展在第一次执行命令时被激活
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  // 使用 console 输出诊断信息（console.log）和错误（console.error）
  // 这行代码只会在扩展被激活时执行一次
  console.log('Congratulations, your extension "helloworld" is now active!');
  vscode.window.showInformationMessage("Hello World from Doc-Doctor!");
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  // 该命令已在 package.json 文件中定义
  // 现在通过 registerCommand 实现该命令
  // commandId 参数必须与 package.json 中的 command 字段一致
  const disposable = vscode.commands.registerCommand(
    "helloworld.helloWorld",
    async () => {
      const gitExtensionApi =
        vscode.extensions.getExtension<gitExtension.GitExtension>(
          "vscode.git"
        )?.exports;
      if (!gitExtensionApi) {
        vscode.window.showErrorMessage("未找到 Git 扩展");
        return;
      }
      const git = gitExtensionApi.getAPI(1);
      const repos = git.repositories;
      const repo = repos[0]; // 默认取第一个仓库
      const uri = vscode.window.activeTextEditor?.document.uri;
      if (!repo || !uri) {
        vscode.window.showErrorMessage("未找到 Git 仓库或活动编辑器");
        return;
      }
      //获取当前项目的变更内容
      getDiff(repo);
      //获取当前项目的变更文件路径
      getAddress(repo);
    }
  );

  context.subscriptions.push(disposable);
}

// 当你的扩展被释放（停用）时会调用此方法
export function deactivate() {}
