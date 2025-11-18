#include <ctype.h>
#include <stddef.h>

size_t count_letters(const char *text) {
    size_t total = 0;
    for (const char *ptr = text; ptr != NULL && *ptr != '\0'; ++ptr) {
        if (isalpha((unsigned char)*ptr)) {
            ++total;
        }
    }
    return total;
}

size_t count_words(const char *text) {
    size_t words = 0;
    int in_word = 0;
    for (const char *ptr = text; ptr != NULL && *ptr != '\0'; ++ptr) {
        if (isspace((unsigned char)*ptr)) {
            in_word = 0;
        } else if (!in_word) {
            in_word = 1;
            ++words;
        }
    }
    return words;
}

