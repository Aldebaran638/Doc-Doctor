/**
 * Doc-Doctor 数据库模块测试程序
 * 
 * 用于本地测试数据库功能，不会被编译到动态库中
 * 
 * 编译方式（单独编译测试程序）：
 * g++ -o test_db main.cpp database.cpp -lsqlite3 -std=c++17
 */

#include "database.h"
#include <iostream>
#include <string>

int main() {
    std::cout << "=== Doc-Doctor Database Test ===" << std::endl;

    // 1. 初始化数据库
    std::cout << "\n[Test 1] Initialize database..." << std::endl;
    int rc = initDatabase("test_problems.db");
    if (rc != 0) {
        std::cerr << "Failed to initialize database!" << std::endl;
        return 1;
    }
    std::cout << "Database initialized successfully." << std::endl;

    // 2. 清空数据库
    std::cout << "\n[Test 2] Clear existing data..." << std::endl;
    clearProblems();

    // 3. 插入测试数据
    std::cout << "\n[Test 3] Insert test problems..." << std::endl;
    
    const char* problem1 = R"({
        "problem_type": 3,
        "file_path": "src/main.c",
        "function_signature": "int main(int argc, char* argv[])",
        "function_name": "main",
        "line_number": 10,
        "column_number": 1,
        "problem_description": "缺少函数功能描述（@brief）",
        "function_snippet": "int main(int argc, char* argv[]) { return 0; }",
        "check_timestamp": "2025-12-22T22:00:00.000Z",
        "status": 0
    })";

    int id1 = saveProblem(problem1);
    std::cout << "Inserted problem 1 with ID: " << id1 << std::endl;

    const char* problem2 = R"({
        "problem_type": 1,
        "file_path": "src/utils.c",
        "function_signature": "int add(int a, int b)",
        "function_name": "add",
        "line_number": 25,
        "column_number": 5,
        "problem_description": "缺少参数 \"a\" 的说明（@param a）",
        "function_snippet": "int add(int a, int b) { return a + b; }",
        "check_timestamp": "2025-12-22T22:00:00.000Z",
        "status": 0
    })";

    int id2 = saveProblem(problem2);
    std::cout << "Inserted problem 2 with ID: " << id2 << std::endl;

    // 4. 读取所有问题
    std::cout << "\n[Test 4] Load all problems..." << std::endl;
    const char* allProblems = loadAllProblems();
    if (allProblems) {
        std::cout << "Loaded problems JSON:" << std::endl;
        std::cout << allProblems << std::endl;
    } else {
        std::cerr << "Failed to load problems!" << std::endl;
    }

    // 5. 更新问题状态
    std::cout << "\n[Test 5] Update problem status..." << std::endl;
    rc = updateProblemStatus(id1, 1);  // 标记为已完成
    if (rc == 0) {
        std::cout << "Problem " << id1 << " marked as completed." << std::endl;
    } else {
        std::cerr << "Failed to update status!" << std::endl;
    }

    // 6. 再次读取验证
    std::cout << "\n[Test 6] Verify update..." << std::endl;
    allProblems = loadAllProblems();
    if (allProblems) {
        std::cout << "Updated problems JSON:" << std::endl;
        std::cout << allProblems << std::endl;
    }

    // 7. 关闭数据库
    std::cout << "\n[Test 7] Close database..." << std::endl;
    closeDatabase();

    std::cout << "\n=== All tests completed ===" << std::endl;
    return 0;
}



