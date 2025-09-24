import * as vscode from "vscode";
import * as gitExtension from "../git";
export async function getAddress(repo: gitExtension.Repository): Promise<void> {
  /*******以下代码，可获取所有未暂存和已暂存的变更文件的路径 */

  const gitExtensionApi =
    vscode.extensions.getExtension<gitExtension.GitExtension>(
      "vscode.git"
    )?.exports;
  if (gitExtensionApi) {
    const git = gitExtensionApi.getAPI(1);
    const repos = git.repositories;
    if (repos.length === 0) {
      vscode.window.showInformationMessage("当前没有 Git 仓库");

      return;
    }
    vscode.window.showInformationMessage("当前有 Git 仓库");
    const repo = repos[0]; // 默认取第一个仓库
    // 获取未暂存的修改
    const workingTreeChanges = repo.state.workingTreeChanges;
    // 获取已暂存但未提交的修改
    const indexChanges = repo.state.indexChanges;

    let msg = "未暂存的修改:\n";
    msg +=
      workingTreeChanges.map((change) => change.uri.fsPath).join("\n") || "无";
    msg += "\n\n已暂存但未提交的修改:\n";
    msg += indexChanges.map((change) => change.uri.fsPath).join("\n") || "无";

    console.log(msg);
  }
}
