#include <stdbool.h>
/**
 * @name add_number
 * @param int lhs
 * @param int rhs
 * @return int
 */
int add_numbers(int lhs, int rhs)
{
    return lhs + rhs;
}

int multiply_numbers(int lhs, int rhs)
{
    return lhs * rhs;
}

bool is_even(int value)
{
    return (value & 1) == 0;
}
