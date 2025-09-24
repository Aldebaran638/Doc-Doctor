const TreeSitter = require("web-tree-sitter");
const path = require("path");

async function main() {
  try {
    // 初始化 TreeSitter
    await TreeSitter.Parser.init();
    console.log("TreeSitter initialized successfully");

    // 创建解析器
    const parser = new TreeSitter.Parser();
    console.log("Parser created successfully");

    // 尝试加载 C++ 语言支持
    // 注意：这需要 tree-sitter-cpp.wasm 文件
    try {
      // 尝试从 node_modules 加载
      const cppWasmPath = path.join(
        __dirname,
        "node_modules",
        "tree-sitter-cpp",
        "tree-sitter-cpp.wasm"
      );
      console.log("Trying to load C++ language from:", cppWasmPath);

      const Cpp = await TreeSitter.Language.load(cppWasmPath);
      parser.setLanguage(Cpp);
      console.log("C++ language loaded successfully");

      // 解析 C++ 代码
      const code = `
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
            `.trim();

      const tree = parser.parse(code);
      console.log("Code parsed successfully");
      console.log("Root node:", tree.rootNode.toString());

      // 遍历语法树
      function traverse(node: any, depth = 0) {
        const indent = "  ".repeat(depth);
        console.log(`${indent}${node.type}: ${node.text.substring(0, 50)}`);

        for (let i = 0; i < node.childCount; i++) {
          traverse(node.child(i), depth + 1);
        }
      }

      console.log("\nSyntax tree:");
      traverse(tree.rootNode);
    } catch (langError) {
      console.log("Failed to load C++ language:", langError.message);
      console.log(
        "This is expected if tree-sitter-cpp.wasm file is not available"
      );
      console.log(
        "You can download it from: https://github.com/tree-sitter/tree-sitter-cpp"
      );
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);
