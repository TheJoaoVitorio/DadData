import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { ExportOptions, ExportResult } from '../shared/types/database';

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
      message: `Exportado com sucesso para CSV (${rows.length} registros)`
    };
  }

  static async exportToExcel(
    columns: string[],
    rows: Record<string, any>[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const filePath = options.targetFilePath || path.join(process.cwd(), `export_${Date.now()}.xlsx`);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DadData';
    workbook.created = new Date();

    // Clean sheet name: remove invalid characters [ * ? : / \ ] and limit to 31 chars
    let cleanSheetName = (options.sheetName || 'Dados')
      .replace(/[\\/?*\[\]:]/g, '_')
      .trim();
    if (cleanSheetName.length > 31) {
      cleanSheetName = cleanSheetName.substring(0, 31);
    }
    if (!cleanSheetName) {
      cleanSheetName = 'Dados';
    }

    const worksheet = workbook.addWorksheet(cleanSheetName);

    // Fallback: derive columns from rows if columns array is empty
    const effectiveColumns =
      columns && columns.length > 0
        ? columns
        : rows.length > 0
        ? Object.keys(rows[0])
        : [];

    worksheet.columns = effectiveColumns.map(col => ({
      header: col,
      key: col,
      width: Math.max(col.length + 4, 14)
    }));

    // Header styling: Nocra AbacatePay yellow accent (#FACC15) with bold text
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FF18181B' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFACC15' } // Yellow accent
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        bottom: { style: 'medium', color: { argb: 'FFEAB308' } },
        right: { style: 'thin', color: { argb: 'FFE4E4E7' } }
      };
    });

    // Add rows with formatting
    for (let i = 0; i < rows.length; i++) {
      const rowData = rows[i];
      const sanitizedRow: Record<string, any> = {};

      for (const col of effectiveColumns) {
        let val = rowData[col];
        if (typeof val === 'bigint') {
          val = val.toString();
        } else if (val instanceof Date) {
          val = val.toISOString();
        }
        sanitizedRow[col] = val ?? '';
      }

      const row = worksheet.addRow(sanitizedRow);
      row.height = 22;

      // Alternating row styling (zebra)
      const isEven = i % 2 === 0;
      row.eachCell(cell => {
        cell.font = { size: 10, color: { argb: 'FF27272A' } };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFF4F4F5' } },
          left: { style: 'thin', color: { argb: 'FFF4F4F5' } },
          bottom: { style: 'thin', color: { argb: 'FFF4F4F5' } },
          right: { style: 'thin', color: { argb: 'FFF4F4F5' } }
        };
        if (!isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFAFAFA' }
          };
        }
      });
    }

    await workbook.xlsx.writeFile(filePath);
    const stats = fs.statSync(filePath);

    return {
      success: true,
      filePath,
      rowCount: rows.length,
      fileSizeBytes: stats.size,
      message: `Exportado com sucesso para Excel (.xlsx) (${rows.length} registros)`
    };
  }

  private static escapeCsvValue(val: any, delimiter: string): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'bigint') return val.toString();

    let str = typeof val === 'object' ? JSON.stringify(val) : String(val);

    // Escape quotes
    if (str.includes('"') || str.includes(delimiter) || str.includes('\n') || str.includes('\r')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
