export const IPC_CHANNELS = {
  // Connection management
  DB_CONNECT: 'db:connect',
  DB_DISCONNECT: 'db:disconnect',
  DB_TEST_CONNECTION: 'db:test-connection',
  DB_GET_ACTIVE_CONNECTIONS: 'db:get-active-connections',
  
  // Metadata & Schema
  DB_LIST_TABLES: 'db:list-tables',
  DB_DESCRIBE_TABLE: 'db:describe-table',
  
  // Queries & CRUD
  DB_EXECUTE_QUERY: 'db:execute-query',
  DB_GET_TABLE_DATA: 'db:get-table-data',
  DB_INSERT_ROW: 'db:insert-row',
  DB_UPDATE_ROW: 'db:update-row',
  DB_DELETE_ROW: 'db:delete-row',
  
  // File dialogues
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  
  // Export engine
  EXPORT_TABLE_OR_QUERY: 'export:table-or-query',

  // Samples loader
  SAMPLES_GET_LIST: 'samples:get-list',
  SAMPLES_LOAD: 'samples:load'
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
