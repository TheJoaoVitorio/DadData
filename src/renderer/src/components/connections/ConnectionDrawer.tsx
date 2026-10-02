import React, { useState } from 'react';
import {
  X,
  FolderOpen,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Server,
  Layers
} from 'lucide-react';
import { DatabaseType, ConnectionConfig } from '@shared/types/database';
import { DatabaseIcon } from '../icons/DatabaseIcon';
import { safeApi } from '../../services/api-client';

interface ConnectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: ConnectionConfig) => Promise<void>;
}

interface EngineOption {
  type: DatabaseType;
  label: string;
  category: 'legacy' | 'modern';
  defaultPort?: number;
  extensions?: string[];
  description: string;
}

const ENGINES: EngineOption[] = [
  // Legacy
  { type: 'dbf', label: 'dBase / FoxPro (.DBF)', category: 'legacy', extensions: ['dbf'], description: 'Tabelas isoladas ou diretório de arquivos .DBF' },
  { type: 'paradox', label: 'Paradox (.DB)', category: 'legacy', extensions: ['db'], description: 'Formato clássico Borland/Corel Paradox 3.5 a 7.0' },
  { type: 'access', label: 'Microsoft Access', category: 'legacy', extensions: ['mdb', 'accdb'], description: 'Banco de dados Jet / ACE Engine (.MDB e .ACCDB)' },
  { type: 'hfsql', label: 'HFSQL (.FIC)', category: 'legacy', extensions: ['fic'], description: 'PC SOFT HyperFileSQL Classic para WinDev' },
  { type: 'nexusdb', label: 'NexusDB (.NX1)', category: 'legacy', extensions: ['nx1'], description: 'Motor de banco de dados Delphi NexusDB v4' },
  { type: 'firebird', label: 'Firebird (.FDB)', category: 'legacy', defaultPort: 3050, extensions: ['fdb'], description: 'Banco relacional Firebird SQL (Dialeto 1 e 3)' },

  // Modern
  { type: 'sqlite', label: 'SQLite 3', category: 'modern', extensions: ['sqlite', 'db', 'sqlite3'], description: 'Arquivo local em disco ou memória' },
  { type: 'postgres', label: 'PostgreSQL', category: 'modern', defaultPort: 5432, description: 'Postgres v9 a v17 com múltiplos schemas' },
  { type: 'mysql', label: 'MySQL / MariaDB', category: 'modern', defaultPort: 3306, description: 'MySQL 5.5 a 8.4 e MariaDB' },
  { type: 'mssql', label: 'SQL Server', category: 'modern', defaultPort: 1433, description: 'Microsoft SQL Server (T-SQL)' },
  { type: 'mongodb', label: 'MongoDB', category: 'modern', defaultPort: 27017, description: 'Banco NoSQL de documentos BSON/JSON' }
];

export const ConnectionDrawer: React.FC<ConnectionDrawerProps> = ({ isOpen, onClose, onConnect }) => {
  const [selectedEngine, setSelectedEngine] = useState<EngineOption>(ENGINES[0]);
  const [connName, setConnName] = useState('Conexão DBF');
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
    if (eng.type === 'firebird') {
      setUser('SYSDBA');
      setPassword('masterkey');
      setHost('127.0.0.1');
      setPort(3050);
    }
    setTestResult(null);
  };

  const handleBrowseFile = async () => {
    try {
      const filters = selectedEngine.extensions
        ? [{ name: selectedEngine.label, extensions: selectedEngine.extensions }, { name: 'Todos os Arquivos', extensions: ['*'] }]
        : undefined;
      const file = await safeApi.openFileDialog(filters);
      if (file) {
        setFilePath(file);
        if (selectedEngine.type === 'firebird') {
          setDatabase(file);
        }
        setTestResult(null);
      }
    } catch (err: any) {
      alert(`Erro ao selecionar arquivo: ${err.message}`);
    }
  };

  const handleBrowseDir = async () => {
    try {
      const dir = await safeApi.openDirectoryDialog();
      if (dir) {
        setFilePath(dir);
        setTestResult(null);
      }
    } catch (err: any) {
      alert(`Erro ao selecionar pasta: ${err.message}`);
    }
  };

  const buildConfig = (): ConnectionConfig => ({
    id: `conn_${Date.now()}`,
    name: connName,
    type: selectedEngine.type,
    filePath: filePath || (selectedEngine.type === 'firebird' ? database : undefined),
    directoryPath: isFileBased && filePath && !filePath.includes('.') ? filePath : undefined,
    host: selectedEngine.type === 'firebird' ? (host || '127.0.0.1') : (!isFileBased ? host : undefined),
    port: selectedEngine.type === 'firebird' ? (port || 3050) : (!isFileBased ? port : undefined),
    database: filePath || database || undefined,
    user: selectedEngine.type === 'firebird' ? (user || 'SYSDBA') : (!isFileBased ? user : undefined),
    password: selectedEngine.type === 'firebird' ? (password || 'masterkey') : (!isFileBased ? password : undefined),
    ssl: !isFileBased ? ssl : undefined
  });

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const config = buildConfig();
      const res = await safeApi.testConnection(config);
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
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer Panel Sliding From Right */}
      <aside className="fixed inset-y-0 right-0 z-50 w-[540px] max-w-full bg-white shadow-2xl flex flex-col border-l border-slate-200/80 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-purple-50 border border-purple-100">
              <DatabaseIcon type={selectedEngine.type} className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nova Conexão</h3>
              <p className="text-xs text-slate-500">Escolha o banco e configure os parâmetros de acesso</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="px-5 pt-3 pb-2 flex gap-1.5 select-none bg-slate-50/50 border-b border-slate-100">
          {[
            { id: 'all', label: 'Todos os Bancos' },
            { id: 'legacy', label: 'Bancos Legados & ERP' },
            { id: 'modern', label: 'Modernos & Servidores' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200/70 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Database Engine Selector Grid with Official SVGs */}
        <div className="px-5 py-3 border-b border-slate-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Motor de Banco de Dados
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {filteredEngines.map(eng => {
              const isSelected = selectedEngine.type === eng.type;
              return (
                <button
                  key={eng.type}
                  type="button"
                  onClick={() => handleSelectEngine(eng)}
                  className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50/50 shadow-sm ring-2 ring-purple-200'
                      : 'border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <DatabaseIcon type={eng.type} className="w-7 h-7 flex-shrink-0" />
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 truncate">{eng.label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{eng.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleConnectSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Connection Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Identificação da Conexão</label>
            <input
              type="text"
              required
              value={connName}
              onChange={e => setConnName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs text-slate-800 focus:outline-none transition-all"
            />
          </div>

          {selectedEngine.type === 'firebird' ? (
            /* Firebird Configuration: File (.FDB) + Host / Port / User / Password */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Arquivo do Banco Firebird (.FDB / .GDB)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Ex: C:\Sistemas\DADOS.FDB"
                    value={filePath}
                    onChange={e => {
                      setFilePath(e.target.value);
                      setDatabase(e.target.value);
                    }}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs text-slate-800 font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFile}
                    className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-purple-600" />
                    <span>Arquivo</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Selecione o arquivo do banco no seu computador (.FDB).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Usuário</label>
                  <input
                    type="text"
                    required
                    value={user}
                    onChange={e => setUser(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Senha</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ) : isFileBased ? (
            /* File Based Configuration */
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Caminho do Arquivo ou Diretório
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ex: C:\Sistemas\CLIENTES.DBF ou pasta"
                  value={filePath}
                  onChange={e => setFilePath(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs text-slate-800 font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleBrowseFile}
                  className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-purple-600" />
                  <span>Arquivo</span>
                </button>
                {selectedEngine.type === 'dbf' && (
                  <button
                    type="button"
                    onClick={handleBrowseDir}
                    className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pasta</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Selecione o arquivo de dados ou informe a pasta onde se encontram as tabelas.
              </p>
            </div>
          ) : (
            /* Server Based Configuration */
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Host / IP</label>
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

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Database</label>
                  <input
                    type="text"
                    placeholder="nome_do_banco"
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

          {/* Test Status Banner */}
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
        </form>

        {/* Drawer Actions Footer */}
        <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="px-4 py-2 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <FileCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConnectSubmit}
              disabled={isConnecting}
              className="px-6 py-2.5 rounded-full bg-[#121217] hover:bg-black text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <span>{isConnecting ? 'Conectando...' : 'Conectar Banco'}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
