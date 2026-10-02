import React, { useState } from 'react';
import {
  X,
  Database,
  FolderOpen,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Server,
  Layers
} from 'lucide-react';
import { DatabaseType, ConnectionConfig } from '@shared/types/database';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: ConnectionConfig) => Promise<void>;
}

interface EngineOption {
  type: DatabaseType;
  label: string;
  category: 'legacy' | 'modern';
  icon: string;
  defaultPort?: number;
  extensions?: string[];
  description: string;
}

const ENGINES: EngineOption[] = [
  // Legacy
  { type: 'dbf', label: 'dBase / FoxPro', category: 'legacy', icon: '📁', extensions: ['dbf'], description: 'Arquivos .DBF com suporte a pastas ou arquivos individuais' },
  { type: 'paradox', label: 'Paradox (.DB)', category: 'legacy', icon: '💾', extensions: ['db'], description: 'Formato clássico Borland/Corel 3.5 a 7.0 para Delphi/ERP' },
  { type: 'access', label: 'Microsoft Access', category: 'legacy', icon: '📑', extensions: ['mdb', 'accdb'], description: 'Banco de dados Jet / ACE Engine (.MDB e .ACCDB)' },
  { type: 'hfsql', label: 'HFSQL (.FIC)', category: 'legacy', icon: '📦', extensions: ['fic'], description: 'PC SOFT HyperFileSQL Classic para WinDev / WebDev' },
  { type: 'nexusdb', label: 'NexusDB (.NX1)', category: 'legacy', icon: '🏛️', extensions: ['nx1'], description: 'Motor de banco de dados Delphi NexusDB v4' },
  { type: 'firebird', label: 'Firebird (.FDB)', category: 'legacy', icon: '🔥', defaultPort: 3050, extensions: ['fdb'], description: 'Banco relacional Firebird SQL (Dialeto 1 e 3)' },

  // Modern
  { type: 'sqlite', label: 'SQLite 3', category: 'modern', icon: '⚡', extensions: ['sqlite', 'db', 'sqlite3'], description: 'Arquivo local autossuficiente e ultrarrápido' },
  { type: 'postgres', label: 'PostgreSQL', category: 'modern', icon: '🐘', defaultPort: 5432, description: 'Postgres v9 a v17 com suporte a múltiplos schemas' },
  { type: 'mysql', label: 'MySQL / MariaDB', category: 'modern', icon: '🐬', defaultPort: 3306, description: 'MySQL 5.5 a 8.4 e MariaDB com autenticação nativa' },
  { type: 'mssql', label: 'SQL Server', category: 'modern', icon: '🏢', defaultPort: 1433, description: 'Microsoft SQL Server com T-SQL' },
  { type: 'mongodb', label: 'MongoDB', category: 'modern', icon: '🍃', defaultPort: 27017, description: 'Banco de documentos NoSQL e coleções BSON' }
];

export const ConnectionModal: React.FC<ConnectionModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [selectedEngine, setSelectedEngine] = useState<EngineOption>(ENGINES[0]);
  const [connName, setConnName] = useState('Minha Conexão DBF');
  const [filePath, setFilePath] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState<number>(ENGINES[0].defaultPort || 5432);
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(false);

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'legacy' | 'modern'>('all');

  if (!isOpen) return null;

  const isFileBased = ['sqlite', 'dbf', 'paradox', 'access', 'hfsql', 'nexusdb'].includes(selectedEngine.type);

  const handleSelectEngine = (eng: EngineOption) => {
    setSelectedEngine(eng);
    setConnName(`Conexão ${eng.label}`);
    if (eng.defaultPort) setPort(eng.defaultPort);
    setTestResult(null);
  };

  const handleBrowseFile = async () => {
    try {
      const filters = selectedEngine.extensions
        ? [{ name: selectedEngine.label, extensions: selectedEngine.extensions }, { name: 'Todos os Arquivos', extensions: ['*'] }]
        : undefined;
      const file = await window.api.openFileDialog(filters);
      if (file) {
        setFilePath(file);
        setTestResult(null);
      }
    } catch (err: any) {
      alert(`Erro ao abrir diálogo: ${err.message}`);
    }
  };

  const handleBrowseDir = async () => {
    try {
      const dir = await window.api.openDirectoryDialog();
      if (dir) {
        setFilePath(dir);
        setTestResult(null);
      }
    } catch (err: any) {
      alert(`Erro ao abrir diálogo de pasta: ${err.message}`);
    }
  };

  const buildConfig = (): ConnectionConfig => ({
    id: `conn_${Date.now()}`,
    name: connName,
    type: selectedEngine.type,
    filePath: isFileBased ? filePath : undefined,
    directoryPath: isFileBased && filePath && !filePath.includes('.') ? filePath : undefined,
    host: !isFileBased ? host : undefined,
    port: !isFileBased ? port : undefined,
    database: !isFileBased ? database : undefined,
    user: !isFileBased ? user : undefined,
    password: !isFileBased ? password : undefined,
    ssl: !isFileBased ? ssl : undefined
  });

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const config = buildConfig();
      const res = await window.api.testConnection(config);
      setTestResult({
        success: res.success,
        message: res.message || (res.success ? 'Conexão validada com sucesso!' : 'Falha na conexão')
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    try {
      const config = buildConfig();
      await onConnect(config);
      onClose();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Falha ao conectar: ${err.message}`
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const filteredEngines = ENGINES.filter(
    e => activeCategory === 'all' || e.category === activeCategory
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80 w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Nova Conexão</h3>
            <p className="text-xs text-slate-500">Selecione o motor de banco de dados e configure os parâmetros.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Engine Category Pills */}
        <div className="flex gap-2 pt-3 pb-2 select-none">
          {[
            { id: 'all', label: 'Todos os Motores' },
            { id: 'legacy', label: '💾 Bancos Legados & Arquivos' },
            { id: 'modern', label: '⚡ Modernos & Servidores' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Engine Grid Selector */}
        <div className="grid grid-cols-3 gap-2 py-2 max-h-36 overflow-y-auto pr-1">
          {filteredEngines.map(eng => {
            const isSelected = selectedEngine.type === eng.type;
            return (
              <button
                key={eng.type}
                type="button"
                onClick={() => handleSelectEngine(eng)}
                className={`p-2.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50/50 shadow-sm ring-2 ring-purple-200'
                    : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-xl">{eng.icon}</span>
                <div className="truncate">
                  <div className="text-xs font-bold text-slate-900 truncate">{eng.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{eng.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Form Fields */}
        <form onSubmit={handleConnectSubmit} className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 border-t border-slate-100 mt-2">
          {/* Connection Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Conexão</label>
            <input
              type="text"
              required
              value={connName}
              onChange={e => setConnName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs text-slate-800 focus:outline-none"
            />
          </div>

          {isFileBased ? (
            /* File Based Inputs */
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Caminho do Arquivo ou Pasta ({selectedEngine.label})
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ex: C:\Dados\CLIENTES.DBF ou pasta com arquivos"
                  value={filePath}
                  onChange={e => setFilePath(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs text-slate-800 font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleBrowseFile}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-purple-600" />
                  <span>Arquivo</span>
                </button>
                {selectedEngine.type === 'dbf' && (
                  <button
                    type="button"
                    onClick={handleBrowseDir}
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Pasta DBFs</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Server Based Inputs */
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Host / Servidor</label>
                  <input
                    type="text"
                    required
                    value={host}
                    onChange={e => setHost(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Porta</label>
                  <input
                    type="number"
                    value={port}
                    onChange={e => setPort(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Database</label>
                  <input
                    type="text"
                    placeholder="database_name"
                    value={database}
                    onChange={e => setDatabase(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Usuário</label>
                  <input
                    type="text"
                    placeholder="postgres / root"
                    value={user}
                    onChange={e => setUser(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Senha</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Test Feedback Result */}
          {testResult && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-center gap-2 border ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span className="truncate">{testResult.message}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <FileCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isConnecting}
                className="px-6 py-2 rounded-full bg-[#121217] hover:bg-black text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                <span>{isConnecting ? 'Conectando...' : 'Conectar Agora'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
