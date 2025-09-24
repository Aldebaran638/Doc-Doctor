import * as vscode from "vscode";
import * as gitExtension from "../git";

export async function getDiff(repo: gitExtension.Repository): Promise<void> {
  // 获取所有未暂存和已暂存的变更
  const changes = [
    ...repo.state.workingTreeChanges,
    ...repo.state.indexChanges,
  ];
  for (const change of changes) {
    // 获取每个文件的 diff 内容
    const diff = await repo.diffWithHEAD(change.uri.fsPath);
    // 你可以将 diff 内容输出、保存或展示
    console.log(`文件: ${change.uri.fsPath}\nDiff:\n${diff}`);
  }
}
