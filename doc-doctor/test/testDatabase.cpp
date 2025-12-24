#include <iostream>
#include <string>
#include <windows.h>

typedef int (*initDatabase_t)(const char *);
typedef int (*saveProblem_t)(const char *);
typedef const char *(*loadAllProblems_t)();
typedef void (*closeDatabase_t)();

int main()
{
  // 加载 DLL
  HMODULE hLib = LoadLibraryA("../native/build/Release/doc_doctor_db.dll");
  if (!hLib)
  {
    std::cerr << "无法加载数据库 DLL" << std::endl;
    return 1;
  }

  // 获取函数指针
  auto initDatabase = (initDatabase_t)GetProcAddress(hLib, "initDatabase");
  auto saveProblem = (saveProblem_t)GetProcAddress(hLib, "saveProblem");
  auto loadAllProblems = (loadAllProblems_t)GetProcAddress(hLib, "loadAllProblems");
  auto closeDatabase = (closeDatabase_t)GetProcAddress(hLib, "closeDatabase");

  if (!initDatabase || !saveProblem || !loadAllProblems || !closeDatabase)
  {
    std::cerr << "获取数据库接口失败" << std::endl;
    FreeLibrary(hLib);
    return 1;
  }

  // 初始化数据库
  if (initDatabase("../native/build/Release/problems.db") != 0)
  {
    std::cerr << "数据库初始化失败" << std::endl;
    FreeLibrary(hLib);
    return 1;
  }

  // 插入测试数据
  const char *problem = R"({
    \"problem_type\": 3,
    \"file_path\": \"src/main.c\",
    \"function_signature\": \"int main(int argc, char* argv[])\",
    \"function_name\": \"main\",
    \"line_number\": 10,
    \"column_number\": 1,
    \"problem_description\": \"缺少函数功能描述（@brief）\",
    \"function_snippet\": \"int main(int argc, char* argv[]) { return 0; }\",
    \"check_timestamp\": \"2025-12-22T22:00:00.000Z\",
    \"status\": 0
  })";
  int id = saveProblem(problem);
  std::cout << "插入问题ID: " << id << std::endl;

  // 读取所有问题
  const char *allProblems = loadAllProblems();
  if (allProblems)
  {
    std::cout << "数据库内容: " << std::endl;
    std::cout << allProblems << std::endl;
  }
  else
  {
    std::cout << "数据库无内容或读取失败" << std::endl;
  }

  closeDatabase();
  FreeLibrary(hLib);
  return 0;
}