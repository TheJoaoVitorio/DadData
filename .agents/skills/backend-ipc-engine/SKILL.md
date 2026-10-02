---
name: backend-ipc-engine
description: >-
  Padrões de comunicação IPC, ciclo de vida do Electron Main, streaming de exportação CSV/Excel e segurança no DadData.
---

# Backend & IPC Engine Skill

## Segurança no Processo Electron
- `contextIsolation: true`: Impede que o código do renderizador acesse APIs do Node.js diretamente.
- `nodeIntegration: false`: Previne injeção de scripts maliciosos.
- `sandbox: true` ou isolamento estrito via canal `window.api`.

## Canais IPC Principais

```typescript
export const IPC_CHANNELS = {
  // Conexões
  DB_CONNECT: 'db:connect',
  DB_DISCONNECT: 'db:disconnect',
  DB_TEST_CONNECTION: 'db:test-connection',
  DB_LIST_CONNECTIONS: 'db:list-connections',
  
  // Metadados
  DB_LIST_TABLES: 'db:list-tables',
  DB_DESCRIBE_TABLE: 'db:describe-table',
  
  // Queries & CRUD
  DB_EXECUTE_QUERY: 'db:execute-query',
  DB_INSERT_ROW: 'db:insert-row',
  DB_UPDATE_ROW: 'db:update-row',
  DB_DELETE_ROW: 'db:delete-row',
  
  // Diálogos de Sistema
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  
  // Exportação
  EXPORT_DATA: 'export:data'
} as const;
```

## Motor de Exportação
- **CSV**: Suporte a delimitadores configuráveis (vírgula, ponto-e-vírgula), escape correto de aspas e formatação UTF-8 com BOM para compatibilidade com Excel.
- **Excel (.xlsx)**: Criação de planilhas nativas formatadas com cabeçalhos estilizados, larguras automáticas de colunas e suporte a tipos nativos (números, datas, booleanos e strings).
