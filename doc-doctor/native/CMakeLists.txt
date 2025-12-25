cmake_minimum_required(VERSION 3.15)
project(doc_doctor_db VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 输出目录
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/build)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/build)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/build)

# 查找 SQLite3
find_package(SQLite3 REQUIRED)

# 查找 nlohmann_json (如果已安装)
find_package(nlohmann_json QUIET)

# 源文件
set(SOURCES
    src/database.cpp
)

# 创建动态库
add_library(${PROJECT_NAME} SHARED ${SOURCES})

# 包含目录
target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_SOURCE_DIR}/src
    ${SQLite3_INCLUDE_DIRS}
)

# 链接库
target_link_libraries(${PROJECT_NAME} PRIVATE
    SQLite::SQLite3
)

# 如果找到了 nlohmann_json，使用它；否则假设头文件在系统路径中
if(nlohmann_json_FOUND)
    target_link_libraries(${PROJECT_NAME} PRIVATE nlohmann_json::nlohmann_json)
else()
    message(STATUS "nlohmann_json not found via CMake, assuming header-only usage")
    # 如果使用 vcpkg 或手动安装，可能需要手动指定路径
    # target_include_directories(${PROJECT_NAME} PRIVATE /path/to/nlohmann_json/include)
endif()

# Windows 特定设置
if(WIN32)
    # 导出所有符号
    set_target_properties(${PROJECT_NAME} PROPERTIES
        WINDOWS_EXPORT_ALL_SYMBOLS ON
    )
    # 输出文件名（不带 lib 前缀）
    set_target_properties(${PROJECT_NAME} PROPERTIES
        PREFIX ""
        OUTPUT_NAME "doc_doctor_db"
    )
endif()

# Linux/macOS 特定设置
if(UNIX)
    set_target_properties(${PROJECT_NAME} PROPERTIES
        PREFIX ""
        OUTPUT_NAME "doc_doctor_db"
    )
    # 设置符号可见性
    target_compile_options(${PROJECT_NAME} PRIVATE -fvisibility=hidden)
endif()

# 打印配置信息
message(STATUS "=== Doc-Doctor Database Module ===")
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "SQLite3 include: ${SQLite3_INCLUDE_DIRS}")
message(STATUS "Output directory: ${CMAKE_LIBRARY_OUTPUT_DIRECTORY}")




