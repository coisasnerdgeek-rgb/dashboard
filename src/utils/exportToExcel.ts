import * as XLSX from 'xlsx';

interface ExportOptions {
    filename: string;
    sheetName?: string;
    data: any[];
}

export const exportToExcel = ({ data, filename, sheetName = 'Dados' }: ExportOptions): void => {
    if (!data || data.length === 0) {
        console.warn('No data to export');
        return;
    }

    try {
        // Create worksheet from data
        const ws = XLSX.utils.json_to_sheet(data);

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const fullFilename = `${filename}_${timestamp}.xlsx`;

        // Write file
        XLSX.writeFile(wb, fullFilename);
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        throw error;
    }
};

// Helper to format data for export
export const prepareDataForExport = (rows: any[], selectedFields?: string[]): any[] => {
    if (!selectedFields || selectedFields.length === 0) {
        return rows;
    }

    return rows.map(row => {
        const filtered: any = {};
        selectedFields.forEach(field => {
            if (row[field] !== undefined) {
                filtered[field] = row[field];
            }
        });
        return filtered;
    });
};
