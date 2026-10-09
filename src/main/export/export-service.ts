import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { ExportOptions, ExportResult } from '../../shared/types/database';

export class ExportService {
  static async exportToCsv(
    columns: string[],
    rows: Record<string, any>[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const delimiter = options.delimiter || ',';
    const filePath = options.targetFilePath || path.join(process.cwd(), `export_${Date.now()}.csv`);
    const includeHeaders = options.includeHeaders !== false;

    // Fallback: derive columns from rows if columns array is empty
    const effectiveColumns =
      columns && columns.length > 0
        ? columns
        : rows.length > 0
        ? Object.keys(rows[0])
        : [];

    const lines: string[] = [];

    // Header line
    if (includeHeaders && effectiveColumns.length > 0) {
      const headerLine = effectiveColumns
        .map(col => this.escapeCsvValue(col, delimiter))
        .join(delimiter);
      lines.push(headerLine);
    }

    // Data rows
    for (const row of rows) {
      const line = effectiveColumns
        .map(col => this.escapeCsvValue(row[col], delimiter))
        .join(delimiter);
      lines.push(line);
    }

    // UTF-8 BOM for Excel compatibility with Latin and international characters
    const csvContent = '\uFEFF' + lines.join('\r\n');
    fs.writeFileSync(filePath, csvContent, 'utf8');

    const stats = fs.statSync(filePath);
    return {
      success: true,
      filePath,
      rowCount: rows.length,
      fileSizeBytes: stats.size,
      message: `Exported ${rows.length} rows to CSV successfully`
    };
  }

  static async exportToExcel(
    columns: string[],
    rows: Record<string, any>[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const filePath = options.targetFilePath || path.join(process.cwd(), `export_${Date.now()}.xlsx`);

    // Sanitize sheet name: Excel restricts sheet names to 31 chars and bans \ / ? * [ ] :
    const rawSheet = options.sheetName || options.tableName || 'Dados';
    const cleanSheet = rawSheet
      .replace(/[\\/?*\[\]:]/g, '_')
      .trim()
      .slice(0, 31) || 'Dados';

    const effectiveColumns =
      columns && columns.length > 0
        ? columns
        : rows.length > 0
        ? Object.keys(rows[0])
        : [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DadData Universal Client';
    workbook.lastModifiedBy = 'DadData';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(cleanSheet);

    // Initial column widths map
    const columnWidths: Record<string, number> = {};
    effectiveColumns.forEach(col => {
      columnWidths[col] = Math.max(String(col).length + 4, 12);
    });

    // Set columns definition
    worksheet.columns = effectiveColumns.map(col => ({
      header: col,
      key: col,
      width: columnWidths[col]
    }));

    // Header styling: sleek slate header
    if (effectiveColumns.length > 0) {
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' } // Slate-800
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // Process rows and sanitize cell values (handle BigInt, Buffer, complex objects)
    // Also sample widths on the first 100 rows to keep it ultra-fast even for 10,000+ rows
    const sampleLimit = Math.min(rows.length, 100);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowData: Record<string, any> = {};

      for (const col of effectiveColumns) {
        const rawVal = row[col];
        const sanitized = this.sanitizeExcelValue(rawVal);
        rowData[col] = sanitized;

        // Fast width calculation for sample rows
        if (i < sampleLimit && sanitized !== '') {
          const strLen = String(sanitized).length;
          if (strLen > columnWidths[col]) {
            columnWidths[col] = Math.min(strLen + 3, 50);
          }
        }
      }

      worksheet.addRow(rowData);
    }

    // Apply auto-calculated widths
    worksheet.columns.forEach(column => {
      if (column.key && columnWidths[column.key]) {
        column.width = columnWidths[column.key];
      }
    });

    await workbook.xlsx.writeFile(filePath);

    const stats = fs.statSync(filePath);
    return {
      success: true,
      filePath,
      rowCount: rows.length,
      fileSizeBytes: stats.size,
      message: `Exported ${rows.length} rows to Excel workbook successfully`
    };
  }

  private static sanitizeExcelValue(val: any): any {
    if (val === null || val === undefined) return '';
    // ExcelJS fails to serialize BigInt
    if (typeof val === 'bigint') {
      const num = Number(val);
      return Number.isSafeInteger(num) ? num : val.toString();
    }
    // Handle Buffers (e.g. blobs, binary ids)
    if (Buffer.isBuffer(val)) {
      return val.toString('utf8');
    }
    // Handle non-date objects
    if (typeof val === 'object' && !(val instanceof Date)) {
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    return val;
  }

  private static escapeCsvValue(val: any, delimiter: string): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'bigint') return val.toString();
    if (Buffer.isBuffer(val)) return val.toString('utf8');
    if (typeof val === 'object' && !(val instanceof Date)) {
      try {
        const jsonStr = JSON.stringify(val);
        return `"${jsonStr.replace(/"/g, '""')}"`;
      } catch {
        // Fallback
      }
    }
    const str = val instanceof Date ? val.toISOString() : String(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
