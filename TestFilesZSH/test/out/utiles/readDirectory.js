"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = readDirectory;
const vscode = __importStar(require("vscode"));
function readDirectory() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("没有打开的工作区！");
        return;
    }
    // 使用第一个工作区文件夹
    const workspaceFolder = workspaceFolders[0];
    console.log("搜索工作区中的 .c 文件...");
    // 使用 findFiles 查找所有 .c 文件
    // findFiles函数返回的，也就是cFiles，是一个Thenable（即在异步编程中，“将来会得到一个结果的容器/占位符””）对象，最终解析为一个Uri数组
    // findFiles函数是异步的
    vscode.workspace.findFiles("**/*.c", null).then((cFiles) => {
        console.log(`找到 ${cFiles.length} 个 .c 文件:`);
        if (cFiles.length === 0) {
            vscode.window.showInformationMessage("工作区中没有找到 .c 文件");
            return;
        }
        // 显示每个 .c 文件的相对路径
        cFiles.forEach((fileUri) => {
            const relativePath = vscode.workspace.asRelativePath(fileUri);
            console.log(`- ${relativePath}`);
        });
        // 显示结果给用户
        const fileList = cFiles
            .map((fileUri) => vscode.workspace.asRelativePath(fileUri))
            .join("\n");
        vscode.window.showInformationMessage(`找到 ${cFiles.length} 个 .c 文件:\n${fileList}`, { modal: false });
    });
}
//# sourceMappingURL=readDirectory.js.map