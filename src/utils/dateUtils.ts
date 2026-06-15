/**
 * Global cutoff for order filtering.
 * Format: YYYY-MM-DD
 * Orders from this date onwards (inclusive) should be displayed and processed.
 */
export const GLOBAL_DATE_CUTOFF = '2025-11-28';

/**
 * Converts various date formats found in spreadsheets to YYYY-MM-DD for comparison.
 * Supports:
 * - DD/MM/YYYY
 * - DD/MM/YY
 * - YYYY-MM-DD (ISO)
 */
export const toComparableDate = (dateString: string | number | null | undefined): string | null => {
    if (dateString === null || dateString === undefined) return null;
    const str = String(dateString).trim();
    if (!str) return null;

    // Handle ISO format YYYY-MM-DD or similar
    if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.substring(0, 10);

    // Handle DD/MM/YYYY or DD/MM/YY
    const parts = str.split('/');
    if (parts.length >= 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2].split(/\s+/)[0]; // Remove time if present "2024 10:00"

        if (year.length === 2) {
            year = '20' + year;
        }

        if (year.length === 4) {
            return `${year}-${month}-${day}`;
        }
    }

    return null;
};

/**
 * Checks if a date is on or after the global cutoff.
 */
export const isAfterCutoff = (dateString: string | number | null | undefined): boolean => {
    const comparable = toComparableDate(dateString);
    if (!comparable) return true; // Default to showing if date is unparseable? Or false to be strict?
    // Let's be semi-strict: if we have a date and it's old, hide it. 
    // If it's empty/null, we might show it depending on the use case.
    return comparable >= GLOBAL_DATE_CUTOFF;
};
