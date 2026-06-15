
// Helper function to normalize strings for comparison (lowercase, no accents)
export const normalizeString = (str: string): string => {
    if (typeof str !== 'string') return '';
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};
