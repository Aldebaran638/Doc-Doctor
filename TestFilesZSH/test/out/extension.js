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
exports.activate = activate;
exports.deactivate = deactivate;
// 'vscode' 模块包含 VS Code 扩展性 API
// 导入该模块并在下面的代码中使用别名 vscode 引用它
const vscode = __importStar(require("vscode"));
// 当您的扩展被激活时调用此方法
// 您的扩展在第一次执行命令时被激活
function activate(context) {
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
    const disposable2 = vscode.commands.registerCommand("test.readDirectory", () => {
        // 获取当前工作区文件夹
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage("没有打开的工作区！");
            return;
        }
        // 使用第一个工作区文件夹
        const workspaceFolder = workspaceFolders[0];
        console.log("搜索工作区中的 .c 文件...");
        // 使用 findFiles 查找所有 .c 文件
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
    });
    context.subscriptions.push(disposable);
    context.subscriptions.push(disposable2);
}
// 当您的扩展被停用时调用此方法
function deactivate() { }
//# sourceMappingURL=extension.js.map