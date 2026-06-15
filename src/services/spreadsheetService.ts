
import { TableRow } from '../Dashboard/types';

// XLSX is globally available from the script tag in index.html
declare const XLSX: any;

export const parseSpreadsheet = (file: File): Promise<{ data: TableRow[], headers: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        if (!event.target?.result) {
          return reject(new Error("Failed to read file."));
        }
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Using { raw: false } tells sheet_to_json to use the formatted text (.w) of cells.
        // This prevents long numbers (like order IDs) from being converted to JS numbers and losing precision.
        // defval: null ensures empty cells are parsed as null.
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });

        if (jsonData.length < 1 || !jsonData[0]) {
          return resolve({ data: [], headers: [] });
        }

        const headers: string[] = jsonData[0].map(String);
        const data: TableRow[] = jsonData.slice(1).map((row: any[]) => {
          const rowData: TableRow = {};
          headers.forEach((header, index) => {
            // All values are now strings (or null), which is safer for IDs.
            // Other parts of the code (like cleanAndParse) will handle conversion back to number where needed.
            rowData[header] = row[index];
          });
          return rowData;
        });

        // Identify the date column (usually "Data" or "Data do Pedido")
        const dateHeader = headers.find(h => {
          const lower = h.toLowerCase();
          return lower === 'data' || lower === 'data do pedido' || lower === 'data pedido';
        });

        let finalData = data;
        const CUTOFF_DATE = new Date(2024, 11, 1); // 2024-12-01

        if (dateHeader) {
          finalData = data.filter(row => {
            const val = row[dateHeader];
            if (!val) return true; // Keep rows without date to be safe or maybe false? Keeping for now.

            // Parse DD/MM/YYYY
            const parts = String(val).split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1;
              const year = parseInt(parts[2], 10);
              const rowDate = new Date(year, month, day);

              if (rowDate < CUTOFF_DATE) {
                return false;
              }
            }
            return true;
          });
        }

        resolve({ data: finalData, headers });

      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsBinaryString(file);
  });
};