// utils/sortUtils.ts

const letterSizeOrder = ['P', 'M', 'G', 'GG'];

/**
 * Sorts an array of size strings with a custom logic:
 * 1. Pre-defined letter sizes (P, M, G, GG) come first, in that specific order.
 * 2. All other sizes (numeric like '8', '10' or mixed like 'G1') are sorted
 *    afterwards using localeCompare with the numeric option for natural sorting.
 * @param sizes - Array of size strings.
 * @returns A new array with sorted sizes.
 */
export const sortSizes = (sizes: string[]): string[] => {
    const letterSizes: string[] = [];
    const otherSizes: string[] = [];

    sizes.forEach(size => {
        if (letterSizeOrder.includes(size.toUpperCase())) {
            letterSizes.push(size);
        } else {
            otherSizes.push(size);
        }
    });

    // 1. Sort letter sizes according to the predefined order
    letterSizes.sort((a, b) => letterSizeOrder.indexOf(a.toUpperCase()) - letterSizeOrder.indexOf(b.toUpperCase()));

    // 2. Sort all other sizes (numeric, mixed) using localeCompare with numeric option
    otherSizes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return [...letterSizes, ...otherSizes];
};
