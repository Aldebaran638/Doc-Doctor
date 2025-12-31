/**
 * C/C++ test fixtures for comment and parsing scenarios.
 */
export const testFiles = {
  /**
   * Function with complete Doxygen comment.
   */
  completeComment: `
/**
 * @brief 计算两个整数的和
 * @param a 第一个加数
 * @param b 第二个加数
 * @return 两数之和
 */
int add(int a, int b) {
    return a + b;
}
`,
  /**
   * Missing @brief.
   */
  missingBrief: `
/**
 * @param a 第一个加数
 * @param b 第二个加数
 * @return 两数之和
 */
int add(int a, int b) {
    return a + b;
}
`,
  /**
   * Missing @param.
   */
  missingParam: `
/**
 * @brief 计算两个整数的和
 * @return 两数之和
 */
int add(int a, int b) {
    return a + b;
}
`,
  /**
   * Missing @return.
   */
  missingReturn: `
/**
 * @brief 计算两个整数的和
 * @param a 第一个加数
 * @param b 第二个加数
 */
int add(int a, int b) {
    return a + b;
}
`,
  /**
   * Function without any comment.
   */
  noComment: `
int add(int a, int b) {
    return a + b;
}
`,
  /**
   * void function (no @return needed).
   */
  voidFunction: `
/**
 * @brief 打印消息
 * @param message 要打印的消息
 */
void printMessage(const char* message) {
    printf("%s\\n", message);
}
`,
  /**
   * main function.
   */
  mainFunction: `
int main(int argc, char* argv[]) {
    return 0;
}
`,
  /**
   * Multiple functions in one file.
   */
  multipleFunctions: `
/**
 * @brief 计算两个整数的和
 * @param a 第一个加数
 * @param b 第二个加数
 * @return 两数之和
 */
int add(int a, int b) {
    return a + b;
}

/**
 * @brief 计算两个整数的差
 * @param a 被减数
 * @param b 减数
 * @return 两数之差
 */
int subtract(int a, int b) {
    return a - b;
}

int multiply(int a, int b) {
    return a * b;
}
`,
  /**
   * Function with pointer params.
   */
  pointerParams: `
/**
 * @brief 交换两个整数的值
 * @param a 第一个整数的指针
 * @param b 第二个整数的指针
 */
void swap(int* a, int* b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}
`,
  /**
   * Syntax error sample.
   */
  syntaxError: `
int add(int a, int b {
    return a + b;
}
`,
  /**
   * Empty file.
   */
  emptyFile: ``,
  /**
   * Comment-only file.
   */
  onlyComments: `
/**
 * 这是一个注释块
 * 但没有函数定义
 */
`,
  /**
   * Control statements inside function (should not be detected as functions).
   */
  controlStatements: `
void test() {
    if (condition) {
        // do something
    }
    for (int i = 0; i < 10; i++) {
        // loop
    }
    while (true) {
        // infinite loop
    }
    switch (value) {
        case 1:
            break;
        default:
            break;
    }
}
`,
};
