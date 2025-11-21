import * as vscode from "vscode";
import * as gitExtension from "../git";

/**
 * 参数：gitExtension.Repository，即当前仓库
 * 返回值：void
 * 功能描述：获取所有未暂存和已暂存的变更文件的 diff 内容，并输出到console.log
 * @param repo 
 */
export async function getDiff(repo: gitExtension.Repository): Promise<string> {
  let msg = "";
  // 获取所有未暂存和已暂存的变更
  const changes = [
    ...repo.state.workingTreeChanges,
    ...repo.state.indexChanges,
  ];
  for (const change of changes) {
    // 获取每个文件的 diff 内容
    const diff = await repo.diffWithHEAD(change.uri.fsPath);
    msg+=`文件: ${change.uri.fsPath}\nDiff:\n${diff}\n`;
    // 你可以将 diff 内容输出、保存或展示
    console.log(`文件: ${change.uri.fsPath}\nDiff:\n${diff}`);
  }
  return msg;
}
