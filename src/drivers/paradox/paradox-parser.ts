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
    const recordCount = buffer.readUInt32LE(6);
    const fieldCount = buffer.readUInt16LE(33);
    const keyFieldCount = buffer.readUInt16LE(35);

    // Read field definitions (types and lengths)
    // In Paradox 4/5/7, field descriptors begin at offset 78 or 0x78 (120)
    let fieldTypeOffset = 0x78;
    const rawFields: { typeCode: number; length: number }[] = [];

    for (let i = 0; i < fieldCount; i++) {
      if (fieldTypeOffset + 2 > buffer.length) break;
      const typeCode = buffer.readUInt8(fieldTypeOffset);
      const length = buffer.readUInt8(fieldTypeOffset + 1);
      rawFields.push({ typeCode, length });
      fieldTypeOffset += 2;
    }

    // Read field names (null-terminated strings immediately following or in names area)
    let namesOffset = fieldTypeOffset;
    const fieldNames: string[] = [];
    for (let i = 0; i < fieldCount; i++) {
      let nameStr = '';
      while (namesOffset < buffer.length && buffer[namesOffset] !== 0) {
        nameStr += String.fromCharCode(buffer[namesOffset]);
        namesOffset++;
      }
      namesOffset++; // skip null terminator
      fieldNames.push(nameStr || `FIELD_${i + 1}`);
    }

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

    // Read records from data blocks
    const rows: Record<string, any>[] = [];
    const blockSize = 2048;
    let blockOffset = headerSize > 0 ? headerSize : 2048;

    while (blockOffset + blockSize <= buffer.length && rows.length < recordCount) {
      // In Paradox block:
      // Offset 0-1: Next block number
      // Offset 2-3: Prev block number
      // Offset 4-5: Record count or data offset in block
      const recordsInBlock = buffer.readUInt16LE(blockOffset + 4);
      const validRecords = Math.min(recordsInBlock > 0 ? recordsInBlock : 50, recordCount - rows.length);

      let recOffset = blockOffset + 6;
      for (let r = 0; r < validRecords; r++) {
        if (recOffset + recordSize > blockOffset + blockSize) break;

        const row: Record<string, any> = { _rowId: rows.length + 1 };

        for (const field of fields) {
          const valOffset = recOffset + field.offset;
          if (valOffset + field.length <= buffer.length) {
            row[field.name] = ParadoxParser.readFieldValue(buffer, valOffset, field);
          }
        }

        rows.push(row);
        recOffset += recordSize;
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

  static getTypeName(code: number): string {
    switch (code) {
      case 0x01: return 'Alpha (String)';
      case 0x02: return 'Date';
      case 0x03: return 'Short Integer';
      case 0x04: return 'Long Integer';
      case 0x05: return 'Currency';
      case 0x06: return 'Number (Float)';
      case 0x09: return 'Logical (Boolean)';
      case 0x0c: return 'Memo';
      case 0x14: return 'AutoIncrement';
      case 0x16: return 'Timestamp';
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
      case 0x14: return 4;
      case 0x16: return 8;
      default: return 10;
    }
  }

  static readFieldValue(buffer: Buffer, offset: number, field: ParadoxField): any {
    switch (field.typeCode) {
      case 0x01: {
        // String
        const raw = buffer.subarray(offset, offset + field.length);
        const nullIdx = raw.indexOf(0);
        const strBuf = nullIdx >= 0 ? raw.subarray(0, nullIdx) : raw;
        return strBuf.toString('latin1').trim();
      }
      case 0x03: {
        return buffer.readInt16LE(offset);
      }
      case 0x04:
      case 0x14: {
        return buffer.readInt32LE(offset);
      }
      case 0x05:
      case 0x06: {
        // Double (IEEE 754)
        return Number(buffer.readDoubleLE(offset).toFixed(2));
      }
      case 0x09: {
        return buffer.readUInt8(offset) !== 0;
      }
      default: {
        return buffer.subarray(offset, offset + field.length).toString('latin1').trim();
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

    // Write field types
    let fOffset = 0x78;
    fields.forEach(f => {
      buffer.writeUInt8(f.typeCode, fOffset);
      buffer.writeUInt8(f.length, fOffset + 1);
      fOffset += 2;
    });

    // Write field names
    fields.forEach(f => {
      const nameBuf = Buffer.from(f.name + '\0', 'latin1');
      nameBuf.copy(buffer, fOffset);
      fOffset += nameBuf.length;
    });

    // Write records in block
    const blockStart = headerSize;
    buffer.writeUInt16LE(sampleRows.length, blockStart + 4);

    let recPos = blockStart + 6;
    sampleRows.forEach(row => {
      buffer.writeInt32LE(row.CLIENTE_ID, recPos);
      
      const razaoBuf = Buffer.from(row.RAZAO_SOCIAL.padEnd(40, '\0'), 'latin1');
      razaoBuf.copy(buffer, recPos + 4);

      const cnpjBuf = Buffer.from(row.CNPJ.padEnd(18, '\0'), 'latin1');
      cnpjBuf.copy(buffer, recPos + 44);

      buffer.writeDoubleLE(row.LIMITE_CREDITO, recPos + 62);
      buffer.writeUInt8(row.ATIVO ? 1 : 0, recPos + 70);

      recPos += recordSize;
    });

    fs.writeFileSync(filePath, buffer);
  }
}
