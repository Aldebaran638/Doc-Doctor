#include <stddef.h>

float average_reading(const float *values, size_t count) {
    if (values == NULL || count == 0U) {
        return 0.0f;
    }
    float total = 0.0f;
    for (size_t i = 0; i < count; ++i) {
        total += values[i];
    }
    return total / (float)count;
}

int detect_threshold_crossing(const float *values, size_t count, float threshold) {
    if (values == NULL) {
        return -1;
    }
    for (size_t i = 0; i < count; ++i) {
        if (values[i] > threshold) {
            return (int)i;
        }
    }
    return -1;
}

