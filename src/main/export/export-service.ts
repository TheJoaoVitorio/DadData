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

    const lines: string[] = [];

    // Header line
    if (includeHeaders) {
      const headerLine = columns
        .map(col => this.escapeCsvValue(col, delimiter))
        .join(delimiter);
      lines.push(headerLine);
    }

    // Data rows
    for (const row of rows) {
      const line = columns
        .map(col => this.escapeCsvValue(row[col], delimiter))
        .join(delimiter);
      lines.push(line);
    }

    // UTF-8 BOM for Excel compatibility with Latin characters
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
    const sheetName = options.sheetName || options.tableName || 'Dados';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DadData Universal Client';
    workbook.lastModifiedBy = 'DadData';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName.slice(0, 31)); // Excel limit is 31 chars

    // Set columns
    worksheet.columns = columns.map(col => ({
      header: col,
      key: col,
      width: Math.max(col.length + 4, 12)
    }));

    // Header styling: sleek slate header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate-800
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add rows
    for (const row of rows) {
      const rowData: Record<string, any> = {};
      for (const col of columns) {
        const val = row[col];
        rowData[col] = val !== undefined ? val : '';
      }
      worksheet.addRow(rowData);
    }

    // Auto-fit column widths
    worksheet.columns.forEach(column => {
      let maxLen = column.header ? String(column.header).length : 10;
      column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber > 1) {
          const cellLen = cell.value ? String(cell.value).length : 0;
          if (cellLen > maxLen) {
            maxLen = Math.min(cellLen, 50);
          }
        }
      });
      column.width = Math.max(maxLen + 3, 12);
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

  private static escapeCsvValue(val: any, delimiter: string): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
