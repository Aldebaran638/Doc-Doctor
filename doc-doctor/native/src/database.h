/**
 * Doc-Doctor 数据库模块头文件
 * 
 * 提供 SQLite 数据库操作接口，用于存储和读取函数注释问题
 */

#ifndef DOC_DOCTOR_DATABASE_H
#define DOC_DOCTOR_DATABASE_H

#ifdef _WIN32
    #define EXPORT __declspec(dllexport)
#else
    #define EXPORT __attribute__((visibility("default")))
#endif

extern "C" {

/**
 * 初始化数据库
 * 创建数据库文件和 problems 表（如果不存在）
 * 
 * @param dbPath 数据库文件路径
 * @return 0 成功，-1 失败
 */
EXPORT int initDatabase(const char* dbPath);

/**
 * 存储单个问题到数据库
 * 
 * @param jsonInput JSON 格式的问题数据，包含以下字段：
 *   - problem_type: int (1-5)
 *   - file_path: string
 *   - function_signature: string
 *   - function_name: string
 *   - line_number: int
 *   - column_number: int
 *   - problem_description: string
 *   - function_snippet: string
 *   - check_timestamp: string (ISO 8601 格式)
 *   - status: int (0=正常, 1=已完成)
 * @return 插入的记录 ID，失败返回 -1
 */
EXPORT int saveProblem(const char* jsonInput);

/**
 * 从数据库读取所有问题记录
 * 
 * @return JSON 数组格式的字符串，包含所有问题记录
 *         调用者需要使用 freeString() 释放返回的字符串
 *         失败返回 NULL
 */
EXPORT const char* loadAllProblems();

/**
 * 更新问题状态
 * 
 * @param id 问题记录 ID
 * @param status 新状态 (0=正常, 1=已完成)
 * @return 0 成功，-1 失败
 */
EXPORT int updateProblemStatus(int id, int status);

/**
 * 清空所有问题记录
 * 
 * @return 0 成功，-1 失败
 */
EXPORT int clearProblems();

/**
 * 释放由 loadAllProblems 返回的字符串内存
 * 
 * @param str 要释放的字符串指针
 */
EXPORT void freeString(const char* str);

/**
 * 关闭数据库连接
 */
EXPORT void closeDatabase();

}

#endif // DOC_DOCTOR_DATABASE_H


