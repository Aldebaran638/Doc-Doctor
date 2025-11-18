#include <stdio.h>

static int square(int value) {
    return value * value;
}

int main(void) {
    int value = 5;
    printf("square(%d) = %d\n", value, square(value));
    return 0;
}

