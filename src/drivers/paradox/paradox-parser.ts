import fs from 'fs';
import path from 'path';

export interface ParadoxField {
  name: string;
  typeCode: number;
  typeName: string;
  length: number;
  offset: number;
}

export interface ParadoxHeader {
  recordSize: number;
  headerSize: number;
  tableType: number;
  recordCount: number;
  fieldCount: number;
  keyFieldCount: number;
  fields: ParadoxField[];
}

export class ParadoxParser {
  static parse(filePath: string): { header: ParadoxHeader; rows: Record<string, any>[] } {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Paradox file not found: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 256) {
      throw new Error('Invalid Paradox file: smaller than minimum header');
    }

    const recordSize = buffer.readUInt16LE(0);
    const headerSize = buffer.readUInt16LE(2);
    const tableType = buffer.readUInt8(4);
    const blockSizeCode = buffer.readUInt8(5);
    const blockSize = (blockSizeCode > 0 ? blockSizeCode : 2) * 1024;
    const recordCount = buffer.readUInt32LE(6);
    const totalBlocks = buffer.readUInt16LE(10);
    const fieldCount = buffer.readUInt16LE(33);
    const keyFieldCount = buffer.readUInt16LE(35);

    // 1. Locate field descriptors (type & length)
    // Paradox 4/5/7 starts at 0x78 (120), Paradox 3.5 starts at 0x58 (88)
    let fieldDescOffset = 0x78;
    if (buffer.readUInt8(0x78) === 0 && buffer.readUInt8(0x58) !== 0) {
      fieldDescOffset = 0x58;
    }

    const rawFields: { typeCode: number; length: number }[] = [];
    for (let i = 0; i < fieldCount; i++) {
      if (fieldDescOffset + 2 > buffer.length) break;
      const typeCode = buffer.readUInt8(fieldDescOffset);
      const length = buffer.readUInt8(fieldDescOffset + 1);
      rawFields.push({ typeCode, length });
      fieldDescOffset += 2;
    }

    // 2. Locate field names pool
    // In Paradox, field names are stored as a sequence of null-terminated ASCII strings
    // located after the pointer table and table path string
    const fieldNames = ParadoxParser.extractFieldNames(buffer, fieldCount, headerSize);

    // 3. Assemble field metadata
    const fields: ParadoxField[] = [];
    let currentOffset = 0;

    for (let i = 0; i < rawFields.length; i++) {
      const rf = rawFields[i];
      const name = fieldNames[i] || `FIELD_${i + 1}`;
      const typeName = ParadoxParser.getTypeName(rf.typeCode);

      fields.push({
        name,
        typeCode: rf.typeCode,
        typeName,
        length: rf.length || ParadoxParser.getDefaultLength(rf.typeCode),
        offset: currentOffset
      });

      currentOffset += (rf.length || ParadoxParser.getDefaultLength(rf.typeCode));
    }

    // 4. Read data records across all data blocks
    const rows: Record<string, any>[] = [];
    let blockOffset = headerSize > 0 ? headerSize : 2048;

    while (blockOffset + blockSize <= buffer.length && rows.length < recordCount) {
      // In Paradox block:
      // Offset 0-1: Next block number
      // Offset 2-3: Prev block number
      // Offset 4-5: Offset of last record in block
      const dataOffset = buffer.readUInt16LE(blockOffset + 4);
      let recordsInBlock = 0;

      if (dataOffset > 0 && recordSize > 0) {
        if (dataOffset < recordSize) {
          recordsInBlock = dataOffset;
        } else {
          recordsInBlock = Math.floor(dataOffset / recordSize) + 1;
        }
      } else {
        recordsInBlock = Math.floor((blockSize - 6) / (recordSize || 1));
      }

      const validRecords = Math.min(recordsInBlock, recordCount - rows.length);

      for (let r = 0; r < validRecords; r++) {
        const recOffset = blockOffset + 6 + r * recordSize;
        if (recOffset + recordSize > buffer.length) break;

        const row: Record<string, any> = { _rowId: rows.length + 1 };

        for (const field of fields) {
          const valOffset = recOffset + field.offset;
          if (valOffset + field.length <= buffer.length) {
            row[field.name] = ParadoxParser.readFieldValue(buffer, valOffset, field);
          }
        }

        rows.push(row);
      }

      blockOffset += blockSize;
    }

    return {
      header: {
        recordSize,
        headerSize,
        tableType,
        recordCount,
        fieldCount,
        keyFieldCount,
        fields
      },
      rows
    };
  }

  static extractFieldNames(buffer: Buffer, fieldCount: number, headerSize: number): string[] {
    const maxSearch = Math.min(headerSize > 0 ? headerSize : 2048, buffer.length);

    // Search for sequence of fieldCount valid null-terminated strings
    for (let start = 120; start < maxSearch - 20; start++) {
      let off = start;
      const candidateNames: string[] = [];
      let valid = true;

      for (let f = 0; f < fieldCount; f++) {
        let nameStr = '';
        while (off < maxSearch && buffer[off] !== 0) {
          const ch = buffer[off];
          // Valid field name characters: alphanumeric, underscore, dollar, hash
          if (ch >= 32 && ch <= 126 && ch !== 47 && ch !== 92 && ch !== 42 && ch !== 58) {
            nameStr += String.fromCharCode(ch);
          } else {
            valid = false;
            break;
          }
          off++;
        }

        if (!valid || buffer[off] !== 0 || nameStr.trim().length === 0 || nameStr.length > 40) {
          valid = false;
          break;
        }

        candidateNames.push(nameStr.trim());
        off++; // skip null terminator
      }

      if (valid && candidateNames.length === fieldCount) {
        return candidateNames;
      }
    }

    // Fallback: generate clean field names
    const fallback: string[] = [];
    for (let i = 1; i <= fieldCount; i++) {
      fallback.push(`FIELD_${i}`);
    }
    return fallback;
  }

  static getTypeName(code: number): string {
    switch (code) {
      case 0x01: return 'Alpha (String)';
      case 0x02: return 'Date';
      case 0x03: return 'Short Integer';
      case 0x04: return 'Long Integer';
      case 0x05: return 'Currency';
      case 0x06: return 'Number (Double)';
      case 0x09: return 'Logical (Boolean)';
      case 0x0c: return 'Memo';
      case 0x0d: return 'Binary (Blob)';
      case 0x0e: return 'Formatted Memo';
      case 0x10: return 'Time';
      case 0x14:
      case 0x16: return 'AutoIncrement';
      case 0x15: return 'BCD (Decimal)';
      default: return `Type_0x${code.toString(16)}`;
    }
  }

  static getDefaultLength(code: number): number {
    switch (code) {
      case 0x01: return 25;
      case 0x02: return 4;
      case 0x03: return 2;
      case 0x04: return 4;
      case 0x05: return 8;
      case 0x06: return 8;
      case 0x09: return 1;
      case 0x10: return 4;
      case 0x14:
      case 0x16: return 4;
      default: return 10;
    }
  }

  static readFieldValue(buffer: Buffer, offset: number, field: ParadoxField): any {
    const b0 = buffer.readUInt8(offset);

    switch (field.typeCode) {
      case 0x01: {
        // String: Alpha
        const raw = buffer.subarray(offset, offset + field.length);
        const nullIdx = raw.indexOf(0);
        const strBuf = nullIdx >= 0 ? raw.subarray(0, nullIdx) : raw;
        const str = strBuf.toString('latin1').trim();
        return str.length > 0 ? str : null;
      }

      case 0x02: {
        // Date: 4-byte BE integer with MSB inverted (days since 01/01/0001)
        const raw = buffer.readUInt32BE(offset);
        if (raw === 0) return null;
        const days = (raw ^ 0x80000000) >>> 0;
        if (days <= 0 || days > 3000000) return null;
        // 01/01/1970 is day 719163
        const epochMs = (days - 719163) * 86400 * 1000;
        try {
          return new Date(epochMs).toISOString().slice(0, 10);
        } catch {
          return null;
        }
      }

      case 0x03: {
        // Short Integer: 2-byte BE with MSB inverted
        if (b0 === 0 && buffer.readUInt8(offset + 1) === 0) return null;
        const val = buffer.readUInt16BE(offset) ^ 0x8000;
        return val >= 0x8000 ? val - 0x10000 : val;
      }

      case 0x04: {
        // Long Integer: 4-byte BE with MSB inverted
        const raw = buffer.readUInt32BE(offset);
        if (raw === 0) return null;
        const val = raw ^ 0x80000000;
        return val >= 0x80000000 ? val - 0x100000000 : val;
      }

      case 0x14:
      case 0x16: {
        // AutoIncrement: 4-byte BE with MSB inverted
        const raw = buffer.readUInt32BE(offset);
        if (raw === 0) return null;
        return (raw ^ 0x80000000) >>> 0;
      }

      case 0x05:
      case 0x06: {
        // Currency ($) and Double (N): 8-byte IEEE-754 with sign bit inverted
        if (b0 === 0) return null; // all zeros = null/blank
        const copy = Buffer.from(buffer.subarray(offset, offset + 8));
        if (b0 & 0x80) {
          copy[0] ^= 0x80;
        } else {
          for (let i = 0; i < 8; i++) copy[i] = ~copy[i];
        }
        const num = copy.readDoubleBE(0);
        if (isNaN(num)) return null;
        return Number(num.toFixed(2));
      }

      case 0x09: {
        // Logical: 1 byte (0x81/0x82 = True, 0x80 = False, 0x00 = Blank)
        if (b0 === 0) return null;
        return (b0 & 0x7f) !== 0;
      }

      case 0x0c:
      case 0x0d:
      case 0x0e: {
        return '[Memo / Blob]';
      }

      case 0x10: {
        // Time: milliseconds since midnight
        const ms = buffer.readUInt32BE(offset) ^ 0x80000000;
        if (ms === 0) return null;
        const secs = Math.floor(ms / 1000);
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }

      default: {
        const raw = buffer.subarray(offset, offset + field.length);
        const nullIdx = raw.indexOf(0);
        const strBuf = nullIdx >= 0 ? raw.subarray(0, nullIdx) : raw;
        const str = strBuf.toString('latin1').trim();
        return str || null;
      }
    }
  }

  static createSampleParadox(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const fields = [
      { name: 'CLIENTE_ID', typeCode: 0x14, length: 4 },
      { name: 'RAZAO_SOCIAL', typeCode: 0x01, length: 40 },
      { name: 'CNPJ', typeCode: 0x01, length: 18 },
      { name: 'LIMITE_CREDITO', typeCode: 0x05, length: 8 },
      { name: 'ATIVO', typeCode: 0x09, length: 1 }
    ];

    const recordSize = 4 + 40 + 18 + 8 + 1; // 71 bytes
    const headerSize = 2048;
    const blockSize = 2048;

    const sampleRows = [
      { CLIENTE_ID: 1, RAZAO_SOCIAL: 'Indústria Metalúrgica Paulista', CNPJ: '12.345.678/0001-90', LIMITE_CREDITO: 50000.0, ATIVO: true },
      { CLIENTE_ID: 2, RAZAO_SOCIAL: 'Logística Transcontinental', CNPJ: '98.765.432/0001-10', LIMITE_CREDITO: 75000.0, ATIVO: true },
      { CLIENTE_ID: 3, RAZAO_SOCIAL: 'Agropecuária Vale Verde', CNPJ: '45.123.789/0001-55', LIMITE_CREDITO: 120000.0, ATIVO: true },
      { CLIENTE_ID: 4, RAZAO_SOCIAL: 'Rede Farma Express', CNPJ: '33.222.111/0001-44', LIMITE_CREDITO: 25000.0, ATIVO: false }
    ];

    const buffer = Buffer.alloc(headerSize + blockSize);

    // Header values
    buffer.writeUInt16LE(recordSize, 0);
    buffer.writeUInt16LE(headerSize, 2);
    buffer.writeUInt8(0x02, 4); // Standard non-indexed table
    buffer.writeUInt8(2, 5); // 2KB blocks
    buffer.writeUInt32LE(sampleRows.length, 6);
    buffer.writeUInt16LE(1, 10); // 1 block
    buffer.writeUInt16LE(fields.length, 33); // Field count
    buffer.writeUInt16LE(1, 35); // Key fields

    // Write field descriptors
    let fOffset = 0x78;
    fields.forEach(f => {
      buffer.writeUInt8(f.typeCode, fOffset);
      buffer.writeUInt8(f.length, fOffset + 1);
      fOffset += 2;
    });

    // Write field names pool
    let namePoolOffset = 600;
    fields.forEach(f => {
      const nameBuf = Buffer.from(f.name + '\0', 'latin1');
      nameBuf.copy(buffer, namePoolOffset);
      namePoolOffset += nameBuf.length;
    });

    // Write records in block
    const blockStart = headerSize;
    // Data offset of last record
    buffer.writeUInt16LE((sampleRows.length - 1) * recordSize, blockStart + 4);

    sampleRows.forEach((row, rIdx) => {
      const recPos = blockStart + 6 + rIdx * recordSize;

      // CLIENTE_ID: AutoIncrement (BE with MSB inverted)
      buffer.writeInt32BE(row.CLIENTE_ID ^ 0x80000000, recPos);

      // RAZAO_SOCIAL
      const razaoBuf = Buffer.from(row.RAZAO_SOCIAL.padEnd(40, '\0'), 'latin1');
      razaoBuf.copy(buffer, recPos + 4);

      // CNPJ
      const cnpjBuf = Buffer.from(row.CNPJ.padEnd(18, '\0'), 'latin1');
      cnpjBuf.copy(buffer, recPos + 44);

      // LIMITE_CREDITO: Currency / Double (BE with sign bit inverted)
      const dBuf = Buffer.alloc(8);
      dBuf.writeDoubleBE(row.LIMITE_CREDITO, 0);
      dBuf[0] ^= 0x80;
      dBuf.copy(buffer, recPos + 62);

      // ATIVO: Logical
      buffer.writeUInt8(row.ATIVO ? 0x81 : 0x80, recPos + 70);
    });

    fs.writeFileSync(filePath, buffer);
  }
}
