/**
 * Doc-Doctor 数据库模块实现
 * 
 * 使用 SQLite3 存储函数注释问题
 * 使用 nlohmann/json 进行 JSON 解析
 */

#include "database.h"
#include <sqlite3.h>
#include <nlohmann/json.hpp>
#include <string>
#include <cstring>
#include <iostream>

using json = nlohmann::json;

// 全局数据库连接
static sqlite3* g_db = nullptr;
static std::string g_lastResult;

/**
 * 创建 problems 表的 SQL 语句
 */
static const char* CREATE_TABLE_SQL = R"(
    CREATE TABLE IF NOT EXISTS problems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        problem_type INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        function_signature TEXT,
        function_name TEXT NOT NULL,
        line_number INTEGER DEFAULT 1,
        column_number INTEGER DEFAULT 1,
        problem_description TEXT,
        function_snippet TEXT,
        check_timestamp TEXT NOT NULL,
        status INTEGER DEFAULT 0
    )
)";

extern "C" {

EXPORT int initDatabase(const char* dbPath) {
    if (g_db != nullptr) {
        // 已经初始化过，先关闭
        sqlite3_close(g_db);
        g_db = nullptr;
    }

    int rc = sqlite3_open(dbPath, &g_db);
    if (rc != SQLITE_OK) {
        std::cerr << "[Doc-Doctor DB] Failed to open database: " << sqlite3_errmsg(g_db) << std::endl;
        sqlite3_close(g_db);
        g_db = nullptr;
        return -1;
    }

    // 创建表
    char* errMsg = nullptr;
    rc = sqlite3_exec(g_db, CREATE_TABLE_SQL, nullptr, nullptr, &errMsg);
    if (rc != SQLITE_OK) {
        std::cerr << "[Doc-Doctor DB] Failed to create table: " << errMsg << std::endl;
        sqlite3_free(errMsg);
        sqlite3_close(g_db);
        g_db = nullptr;
        return -1;
    }

    std::cout << "[Doc-Doctor DB] Database initialized: " << dbPath << std::endl;
    return 0;
}

EXPORT int saveProblem(const char* jsonInput) {
    if (g_db == nullptr) {
        std::cerr << "[Doc-Doctor DB] Database not initialized" << std::endl;
        return -1;
    }

    try {
        json j = json::parse(jsonInput);

        const char* insertSQL = R"(
            INSERT INTO problems (
                problem_type, file_path, function_signature, function_name,
                line_number, column_number, problem_description, function_snippet,
                check_timestamp, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        )";

        sqlite3_stmt* stmt;
        int rc = sqlite3_prepare_v2(g_db, insertSQL, -1, &stmt, nullptr);
        if (rc != SQLITE_OK) {
            std::cerr << "[Doc-Doctor DB] Failed to prepare statement: " << sqlite3_errmsg(g_db) << std::endl;
            return -1;
        }

        // 绑定参数
        sqlite3_bind_int(stmt, 1, j.value("problem_type", 0));
        
        std::string filePath = j.value("file_path", "");
        sqlite3_bind_text(stmt, 2, filePath.c_str(), -1, SQLITE_TRANSIENT);
        
        std::string funcSig = j.value("function_signature", "");
        sqlite3_bind_text(stmt, 3, funcSig.c_str(), -1, SQLITE_TRANSIENT);
        
        std::string funcName = j.value("function_name", "");
        sqlite3_bind_text(stmt, 4, funcName.c_str(), -1, SQLITE_TRANSIENT);
        
        sqlite3_bind_int(stmt, 5, j.value("line_number", 1));
        sqlite3_bind_int(stmt, 6, j.value("column_number", 1));
        
        std::string desc = j.value("problem_description", "");
        sqlite3_bind_text(stmt, 7, desc.c_str(), -1, SQLITE_TRANSIENT);
        
        std::string snippet = j.value("function_snippet", "");
        sqlite3_bind_text(stmt, 8, snippet.c_str(), -1, SQLITE_TRANSIENT);
        
        std::string timestamp = j.value("check_timestamp", "");
        sqlite3_bind_text(stmt, 9, timestamp.c_str(), -1, SQLITE_TRANSIENT);
        
        sqlite3_bind_int(stmt, 10, j.value("status", 0));

        // 执行
        rc = sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        if (rc != SQLITE_DONE) {
            std::cerr << "[Doc-Doctor DB] Failed to insert: " << sqlite3_errmsg(g_db) << std::endl;
            return -1;
        }

        int insertedId = static_cast<int>(sqlite3_last_insert_rowid(g_db));
        std::cout << "[Doc-Doctor DB] Inserted problem with ID: " << insertedId << std::endl;
        return insertedId;

    } catch (const std::exception& e) {
        std::cerr << "[Doc-Doctor DB] JSON parse error: " << e.what() << std::endl;
        return -1;
    }
}

EXPORT const char* loadAllProblems() {
    if (g_db == nullptr) {
        std::cerr << "[Doc-Doctor DB] Database not initialized" << std::endl;
        return nullptr;
    }

    const char* selectSQL = "SELECT * FROM problems ORDER BY status ASC, id DESC";
    sqlite3_stmt* stmt;
    
    int rc = sqlite3_prepare_v2(g_db, selectSQL, -1, &stmt, nullptr);
    if (rc != SQLITE_OK) {
        std::cerr << "[Doc-Doctor DB] Failed to prepare select: " << sqlite3_errmsg(g_db) << std::endl;
        return nullptr;
    }

    json result = json::array();

    while (sqlite3_step(stmt) == SQLITE_ROW) {
        json problem;
        
        problem["id"] = sqlite3_column_int(stmt, 0);
        problem["problem_type"] = sqlite3_column_int(stmt, 1);
        
        const char* filePath = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        problem["file_path"] = filePath ? filePath : "";
        
        const char* funcSig = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
        problem["function_signature"] = funcSig ? funcSig : "";
        
        const char* funcName = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4));
        problem["function_name"] = funcName ? funcName : "";
        
        problem["line_number"] = sqlite3_column_int(stmt, 5);
        problem["column_number"] = sqlite3_column_int(stmt, 6);
        
        const char* desc = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 7));
        problem["problem_description"] = desc ? desc : "";
        
        const char* snippet = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 8));
        problem["function_snippet"] = snippet ? snippet : "";
        
        const char* timestamp = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 9));
        problem["check_timestamp"] = timestamp ? timestamp : "";
        
        problem["status"] = sqlite3_column_int(stmt, 10);

        result.push_back(problem);
    }

    sqlite3_finalize(stmt);

    // 将结果存储到静态变量，避免返回的指针失效
    g_lastResult = result.dump();
    
    std::cout << "[Doc-Doctor DB] Loaded " << result.size() << " problems" << std::endl;
    return g_lastResult.c_str();
}

EXPORT int updateProblemStatus(int id, int status) {
    if (g_db == nullptr) {
        std::cerr << "[Doc-Doctor DB] Database not initialized" << std::endl;
        return -1;
    }

    const char* updateSQL = "UPDATE problems SET status = ? WHERE id = ?";
    sqlite3_stmt* stmt;

    int rc = sqlite3_prepare_v2(g_db, updateSQL, -1, &stmt, nullptr);
    if (rc != SQLITE_OK) {
        std::cerr << "[Doc-Doctor DB] Failed to prepare update: " << sqlite3_errmsg(g_db) << std::endl;
        return -1;
    }

    sqlite3_bind_int(stmt, 1, status);
    sqlite3_bind_int(stmt, 2, id);

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) {
        std::cerr << "[Doc-Doctor DB] Failed to update: " << sqlite3_errmsg(g_db) << std::endl;
        return -1;
    }

    int changes = sqlite3_changes(g_db);
    std::cout << "[Doc-Doctor DB] Updated " << changes << " row(s), id=" << id << ", status=" << status << std::endl;
    return changes > 0 ? 0 : -1;
}

EXPORT int clearProblems() {
    if (g_db == nullptr) {
        std::cerr << "[Doc-Doctor DB] Database not initialized" << std::endl;
        return -1;
    }

    char* errMsg = nullptr;
    int rc = sqlite3_exec(g_db, "DELETE FROM problems", nullptr, nullptr, &errMsg);
    
    if (rc != SQLITE_OK) {
        std::cerr << "[Doc-Doctor DB] Failed to clear: " << errMsg << std::endl;
        sqlite3_free(errMsg);
        return -1;
    }

    std::cout << "[Doc-Doctor DB] All problems cleared" << std::endl;
    return 0;
}

EXPORT void freeString(const char* str) {
    // 由于我们使用静态 string，这里实际上不需要释放
    // 但保留接口以备将来可能的实现变更
    (void)str;
}

EXPORT void closeDatabase() {
    if (g_db != nullptr) {
        sqlite3_close(g_db);
        g_db = nullptr;
        std::cout << "[Doc-Doctor DB] Database closed" << std::endl;
    }
}

} // extern "C"


