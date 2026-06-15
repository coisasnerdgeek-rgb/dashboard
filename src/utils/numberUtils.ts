// Helper function to clean and parse numbers, handling Brazilian currency/number formats
export const cleanAndParse = (val: any): number => {
    const strVal = String(val ?? '0').trim();
    if (strVal === '') return 0;
    
    let cleanedStr = strVal.replace(/R\$\s*/, "");

    if (cleanedStr.includes(',')) {
        // Format is like 1.234,56. Treat '.' as thousands separator.
        cleanedStr = cleanedStr.replace(/\./g, "").replace(",", ".");
    } else if (cleanedStr.includes('.')) {
        const parts = cleanedStr.split('.');
        if (parts.length > 2) { // multiple dots like 1.234.567
            cleanedStr = parts.join('');
        } else if (parts.length === 2 && parts[1].length === 3) { // single dot like 1.234
             cleanedStr = parts.join('');
        }
        // else, single dot with not 3 decimal places, e.g. 46.9, 123.45 - assume decimal, do nothing
    }
    
    const num = parseFloat(cleanedStr);
    return isNaN(num) ? 0 : num;
};