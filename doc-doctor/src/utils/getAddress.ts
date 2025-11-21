import * as vscode from "vscode";
import * as gitExtension from "../git";

/**
 * 参数：gitExtension.Repository，即当前仓库
 * 返回值：void
 * 功能描述：获取所有未暂存和已暂存的变更文件的路径，并输出到console.log
 * @param repo 
 */
export async function getAddress(repo: gitExtension.Repository): Promise<string> {
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

      return "error! repos is null.当前没有 Git 仓库";
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
    return msg;
  }
  return "error! gitExtensionApi is null.当前没有 Git 仓库";
} 
