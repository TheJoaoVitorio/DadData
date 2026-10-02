import fs from 'fs';
import path from 'path';

export interface DbfField {
  name: string;
  type: string;
  length: number;
  decimalCount: number;
  offset: number;
}

export interface DbfHeader {
  version: number;
  lastUpdate: Date;
  recordCount: number;
  headerLength: number;
  recordLength: number;
  fields: DbfField[];
}

export class DbfParser {
  static parse(filePath: string): { header: DbfHeader; rows: Record<string, any>[] } {
    if (!fs.existsSync(filePath)) {
      throw new Error(`DBF file not found: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 32) {
      throw new Error('Invalid DBF: file too small');
    }

    // 1. Parse header
    const version = buffer.readUInt8(0);
    const year = 1900 + buffer.readUInt8(1);
    const month = buffer.readUInt8(2) - 1;
    const day = buffer.readUInt8(3);
    const lastUpdate = new Date(year, month, day);

    const recordCount = buffer.readUInt32LE(4);
    const headerLength = buffer.readUInt16LE(8);
    const recordLength = buffer.readUInt16LE(10);

    const fields: DbfField[] = [];
    let currentFieldOffset = 1; // 1 byte for deletion flag

    for (let pos = 32; pos < headerLength; pos += 32) {
      if (buffer[pos] === 0x0d) {
        break; // End of field descriptors
      }
      if (pos + 32 > buffer.length) break;

      const nameBuffer = buffer.subarray(pos, pos + 11);
      const nullIdx = nameBuffer.indexOf(0);
      const name = (nullIdx >= 0 ? nameBuffer.subarray(0, nullIdx) : nameBuffer)
        .toString('latin1')
        .trim();

      const type = String.fromCharCode(buffer.readUInt8(pos + 11));
      const length = buffer.readUInt8(pos + 16);
      const decimalCount = buffer.readUInt8(pos + 17);

      fields.push({
        name,
        type,
        length,
        decimalCount,
        offset: currentFieldOffset
      });

      currentFieldOffset += length;
    }

    // 2. Parse data records
    const rows: Record<string, any>[] = [];
    let recordStart = headerLength;

    for (let i = 0; i < recordCount; i++) {
      if (recordStart + recordLength > buffer.length) {
        break;
      }

      const deletionFlag = buffer.readUInt8(recordStart);
      const isDeleted = deletionFlag === 0x2a; // '*'

      if (!isDeleted) {
        const row: Record<string, any> = { _rowId: i + 1 };

        for (const field of fields) {
          const fieldStart = recordStart + field.offset;
          const rawValue = buffer.subarray(fieldStart, fieldStart + field.length).toString('latin1').trim();

          let parsedValue: any = rawValue;
          switch (field.type) {
            case 'N':
            case 'F':
              if (rawValue === '') {
                parsedValue = null;
              } else {
                parsedValue = field.decimalCount > 0 ? parseFloat(rawValue) : parseInt(rawValue, 10);
                if (isNaN(parsedValue)) parsedValue = null;
              }
              break;
            case 'D':
              // YYYYMMDD
              if (rawValue.length === 8) {
                const y = rawValue.slice(0, 4);
                const m = rawValue.slice(4, 6);
                const d = rawValue.slice(6, 8);
                parsedValue = `${y}-${m}-${d}`;
              } else {
                parsedValue = null;
              }
              break;
            case 'L':
              parsedValue = ['T', 't', 'Y', 'y'].includes(rawValue);
              break;
            case 'I': // 4-byte LE integer
              try {
                parsedValue = buffer.readInt32LE(fieldStart);
              } catch {
                parsedValue = null;
              }
              break;
            default:
              parsedValue = rawValue;
          }

          row[field.name] = parsedValue;
        }

        rows.push(row);
      }

      recordStart += recordLength;
    }

    return {
      header: {
        version,
        lastUpdate,
        recordCount,
        headerLength,
        recordLength,
        fields
      },
      rows
    };
  }

  static writeRecord(filePath: string, recordData: Record<string, any>): void {
    const { header } = this.parse(filePath);
    const fileHandle = fs.openSync(filePath, 'r+');

    try {
      const buffer = Buffer.alloc(header.recordLength);
      buffer.writeUInt8(0x20, 0); // Active flag

      for (const field of header.fields) {
        const val = recordData[field.name];
        let valStr = '';

        if (val !== undefined && val !== null) {
          if (field.type === 'N' || field.type === 'F') {
            valStr = String(val).padStart(field.length, ' ');
          } else if (field.type === 'D') {
            valStr = String(val).replace(/[-/]/g, '').slice(0, 8);
          } else if (field.type === 'L') {
            valStr = val ? 'T' : 'F';
          } else {
            valStr = String(val).padEnd(field.length, ' ');
          }
        } else {
          valStr = ' '.repeat(field.length);
        }

        const fieldBuf = Buffer.from(valStr.slice(0, field.length), 'latin1');
        fieldBuf.copy(buffer, field.offset);
      }

      // Append record at the end before 0x1A EOF
      const stats = fs.fstatSync(fileHandle);
      const appendPos = stats.size > 0 ? stats.size - 1 : header.headerLength;
      
      fs.writeSync(fileHandle, buffer, 0, header.recordLength, appendPos);
      
      // Write EOF 0x1A
      const eofBuf = Buffer.from([0x1a]);
      fs.writeSync(fileHandle, eofBuf, 0, 1, appendPos + header.recordLength);

      // Update record count in header
      const countBuf = Buffer.alloc(4);
      countBuf.writeUInt32LE(header.recordCount + 1, 0);
      fs.writeSync(fileHandle, countBuf, 0, 4, 4);
    } finally {
      fs.closeSync(fileHandle);
    }
  }

  static createSampleDbf(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fields = [
      { name: 'CODIGO', type: 'N', length: 6, decimalCount: 0, offset: 1 },
      { name: 'NOME', type: 'C', length: 40, decimalCount: 0, offset: 7 },
      { name: 'CIDADE', type: 'C', length: 30, decimalCount: 0, offset: 47 },
      { name: 'SALDO', type: 'N', length: 12, decimalCount: 2, offset: 77 },
      { name: 'ATIVO', type: 'L', length: 1, decimalCount: 0, offset: 89 },
      { name: 'CADASTRO', type: 'D', length: 8, decimalCount: 0, offset: 90 }
    ];

    const recordLength = 1 + 6 + 40 + 30 + 12 + 1 + 8; // 98 bytes
    const headerLength = 32 + fields.length * 32 + 1; // 32 + 192 + 1 = 225

    const sampleRows = [
      { CODIGO: 101, NOME: 'Auto Peças Brasil Ltda', CIDADE: 'São Paulo', SALDO: 15420.50, ATIVO: true, CADASTRO: '20240115' },
      { CODIGO: 102, NOME: 'Distribuidora Alvorada', CIDADE: 'Curitiba', SALDO: 8920.00, ATIVO: true, CADASTRO: '20240210' },
      { CODIGO: 103, NOME: 'Comercial Silva & Cia', CIDADE: 'Belo Horizonte', SALDO: 23150.75, ATIVO: true, CADASTRO: '20240305' },
      { CODIGO: 104, NOME: 'Farmácia Central', CIDADE: 'Porto Alegre', SALDO: 4320.10, ATIVO: false, CADASTRO: '20240412' },
      { CODIGO: 105, NOME: 'Supermercado Progresso', CIDADE: 'Campinas', SALDO: 45890.00, ATIVO: true, CADASTRO: '20240520' }
    ];

    const buf = Buffer.alloc(headerLength + sampleRows.length * recordLength + 1);

    // Header
    buf.writeUInt8(0x03, 0); // dBase III
    const now = new Date();
    buf.writeUInt8(now.getFullYear() - 1900, 1);
    buf.writeUInt8(now.getMonth() + 1, 2);
    buf.writeUInt8(now.getDate(), 3);
    buf.writeUInt32LE(sampleRows.length, 4);
    buf.writeUInt16LE(headerLength, 8);
    buf.writeUInt16LE(recordLength, 10);

    // Fields
    fields.forEach((f, idx) => {
      const pos = 32 + idx * 32;
      const nameBuf = Buffer.from(f.name.padEnd(11, '\0'), 'latin1');
      nameBuf.copy(buf, pos);
      buf.writeUInt8(f.type.charCodeAt(0), pos + 11);
      buf.writeUInt8(f.length, pos + 16);
      buf.writeUInt8(f.decimalCount, pos + 17);
    });

    buf.writeUInt8(0x0d, headerLength - 1); // Header terminator

    // Records
    sampleRows.forEach((row, rIdx) => {
      const recStart = headerLength + rIdx * recordLength;
      buf.writeUInt8(0x20, recStart); // Active flag

      fields.forEach(f => {
        const val = (row as any)[f.name];
        let valStr = '';
        if (f.type === 'N') {
          valStr = (f.decimalCount > 0 ? Number(val).toFixed(f.decimalCount) : String(val)).padStart(f.length, ' ');
        } else if (f.type === 'L') {
          valStr = val ? 'T' : 'F';
        } else {
          valStr = String(val).padEnd(f.length, ' ');
        }
        const fBuf = Buffer.from(valStr.slice(0, f.length), 'latin1');
        fBuf.copy(buf, recStart + f.offset);
      });
    });

    buf.writeUInt8(0x1a, buf.length - 1); // EOF
    fs.writeFileSync(filePath, buf);
  }
}
