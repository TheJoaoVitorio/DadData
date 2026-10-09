import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Check,
  Database,
  Sparkles,
  Server,
  HardDrive
} from 'lucide-react';
import { DatabaseType, ConnectionConfig } from '@shared/types/database';
import { DatabaseIcon } from '../icons/DatabaseIcon';
import { safeApi } from '../../services/api-client';
import { BorderBeam } from '../magicui/border-beam';
import { ShinyButton } from '../magicui/shiny-button';
import { MagicCard } from '../magicui/magic-card';
import { DotPattern } from '../magicui/dot-pattern';

interface ConnectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: ConnectionConfig) => Promise<void>;
}

interface EngineOption {
  type: DatabaseType;
  label: string;
  category: 'legacy' | 'modern';
  categoryLabel: string;
  defaultPort?: number;
  extensions?: string[];
  description: string;
  badge: string;
}

const ENGINES: EngineOption[] = [
  // Modern & Server
  {
    type: 'postgres',
    label: 'PostgreSQL',
    category: 'modern',
    categoryLabel: 'Moderno & Cloud',
    defaultPort: 5432,
    description: 'Postgres v9 a v17 com múltiplos schemas',
    badge: 'SQL Server'
  },
  {
    type: 'mysql',
    label: 'MySQL / MariaDB',
    category: 'modern',
    categoryLabel: 'Moderno & Cloud',
    defaultPort: 3306,
    description: 'MySQL 5.5 a 8.4 e MariaDB',
    badge: 'SQL Server'
  },
  {
    type: 'mssql',
    label: 'SQL Server',
    category: 'modern',
    categoryLabel: 'Moderno & Cloud',
    defaultPort: 1433,
    description: 'Microsoft SQL Server corporativo (T-SQL)',
    badge: 'Microsoft'
  },
  {
    type: 'mongodb',
    label: 'MongoDB',
    category: 'modern',
    categoryLabel: 'Moderno & Cloud',
    defaultPort: 27017,
    description: 'Banco NoSQL distribuído de documentos BSON/JSON',
    badge: 'NoSQL'
  },
  {
    type: 'sqlite',
    label: 'SQLite 3',
    category: 'modern',
    categoryLabel: 'Moderno & Local',
    extensions: ['sqlite', 'db', 'sqlite3'],
    description: 'Arquivo local autocontido em disco ou memória',
    badge: 'Embutido'
  },

  // Legacy & ERP
  {
    type: 'firebird',
    label: 'Firebird (.FDB)',
    category: 'legacy',
    categoryLabel: 'ERP Desktop',
    defaultPort: 3050,
    extensions: ['fdb'],
    description: 'Dialeto 1 e 3 (CLIPP, G10, Compufour)',
    badge: 'ERP Legado'
  },
  {
    type: 'dbf',
    label: 'dBase / FoxPro (.DBF)',
    category: 'legacy',
    categoryLabel: 'ERP Desktop',
    extensions: ['dbf'],
    description: 'Tabelas isoladas ou diretório de arquivos .DBF',
    badge: 'Clipper'
  },
  {
    type: 'paradox',
    label: 'Paradox (.DB)',
    category: 'legacy',
    categoryLabel: 'ERP Desktop',
    extensions: ['db'],
    description: 'Formato clássico Borland/Corel Paradox 3.5 a 7.0',
    badge: 'Borland'
  },
  {
    type: 'access',
    label: 'Microsoft Access',
    category: 'legacy',
    categoryLabel: 'ERP Desktop',
    extensions: ['mdb', 'accdb'],
    description: 'Banco de dados Jet / ACE Engine (.MDB e .ACCDB)',
    badge: 'Access'
  },
  {
    type: 'hfsql',
    label: 'HFSQL (.FIC)',
    category: 'legacy',
    categoryLabel: 'ERP Desktop',
    extensions: ['fic'],
    description: 'PC SOFT HyperFileSQL Classic para WinDev',
    badge: 'WinDev'
  },
  {
    type: 'nexusdb',
    label: 'NexusDB (.NX1)',
    category: 'legacy',
    categoryLabel: 'ERP Desktop',
    extensions: ['nx1'],
    description: 'Motor de banco de dados relacional Delphi NexusDB',
    badge: 'Delphi'
  }
];

export const ConnectionDrawer: React.FC<ConnectionDrawerProps> = ({ isOpen, onClose, onConnect }) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Engine & Filtering State
  const [selectedEngine, setSelectedEngine] = useState<EngineOption>(ENGINES[0]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'modern' | 'legacy'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Configuration Form State
  const [connName, setConnName] = useState('Conexão PostgreSQL');
  const [filePath, setFilePath] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState<number>(5432);
  const [database, setDatabase] = useState('postgres');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(false);
  const [charset, setCharset] = useState('WIN1252');

  // Server Databases Discovery ("Buscar Databases")
  const [discoveredDatabases, setDiscoveredDatabases] = useState<string[]>([]);
  const [isFetchingDatabases, setIsFetchingDatabases] = useState(false);
  const [databaseSearchError, setDatabaseSearchError] = useState<string | null>(null);

  // Testing & Connecting State
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const isFileBased = ['sqlite', 'dbf', 'paradox', 'access', 'hfsql', 'nexusdb'].includes(selectedEngine.type);
  const isServerDatabase = ['postgres', 'mysql', 'mssql', 'mongodb'].includes(selectedEngine.type);

  const handleSelectEngine = (eng: EngineOption) => {
    setSelectedEngine(eng);
    setConnName(`Conexão ${eng.label}`);
    if (eng.defaultPort) setPort(eng.defaultPort);

    // Sensible defaults
    if (eng.type === 'firebird') {
      setUser('SYSDBA');
      setPassword('masterkey');
      setHost('127.0.0.1');
      setPort(3050);
      setCharset('WIN1252');
      setDatabase('');
    } else if (eng.type === 'postgres') {
      setUser('postgres');
      setPassword('');
      setHost('localhost');
      setPort(5432);
      setDatabase('postgres');
    } else if (eng.type === 'mysql') {
      setUser('root');
      setPassword('');
      setHost('localhost');
      setPort(3306);
      setDatabase('');
    } else if (eng.type === 'mssql') {
      setUser('sa');
      setPassword('');
      setHost('localhost');
      setPort(1433);
      setDatabase('master');
    } else if (eng.type === 'mongodb') {
      setUser('');
      setPassword('');
      setHost('localhost');
      setPort(27017);
      setDatabase('admin');
    }

    setTestResult(null);
    setDiscoveredDatabases([]);
    setDatabaseSearchError(null);
  };

  const handleSelectAndProceed = (eng: EngineOption) => {
    handleSelectEngine(eng);
    setStep(2);
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
      alert(`Erro ao selecionar diretório: ${err.message}`);
    }
  };

  const buildConfig = (): ConnectionConfig => {
    const base: ConnectionConfig = {
      id: `conn_${Date.now()}`,
      name: connName || selectedEngine.label,
      type: selectedEngine.type
    };

    if (selectedEngine.type === 'firebird') {
      return {
        ...base,
        host: host || '127.0.0.1',
        port: port || 3050,
        database: database || filePath,
        user: user || 'SYSDBA',
        password: password || 'masterkey',
        options: {
          charset: charset || 'WIN1252'
        }
      };
    }

    if (isFileBased) {
      return {
        ...base,
        filePath
      };
    }

    return {
      ...base,
      host,
      port,
      database,
      user,
      password,
      ssl
    };
  };

  // Buscar Databases no Servidor
  const handleFetchDatabases = async () => {
    setIsFetchingDatabases(true);
    setDatabaseSearchError(null);
    try {
      const currentConfig = buildConfig();
      const dbs = await safeApi.listDatabases(currentConfig);
      if (dbs && dbs.length > 0) {
        setDiscoveredDatabases(dbs);
        if (!database || !dbs.includes(database)) {
          setDatabase(dbs[0]);
        }
      } else {
        setDatabaseSearchError('Nenhum banco de dados retornado pelo servidor.');
      }
    } catch (err: any) {
      setDatabaseSearchError(err.message || 'Falha ao buscar databases no servidor.');
    } finally {
      setIsFetchingDatabases(false);
    }
  };

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

  const filteredEngines = ENGINES.filter(eng => {
    const matchesCategory = activeCategory === 'all' || eng.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      eng.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.badge.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-950/40 backdrop-blur-md animate-in fade-in duration-200">
      {/* Centered Modal Card with Magic UI BorderBeam and DotPattern */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative w-full max-w-[760px] max-h-[90vh] bg-white rounded-[32px] shadow-2xl border border-zinc-200/90 overflow-hidden flex flex-col"
      >
        {/* Subtle Magic UI Dot Pattern Texture */}
        <DotPattern className="opacity-40" />

        {/* Magic UI Border Beam Animation */}
        <BorderBeam size={320} duration={14} borderWidth={2} colorFrom="#FACC15" colorTo="#38BDF8" />

        {/* Top Slim Progress Bar */}
        <div className="relative w-full h-1.5 bg-zinc-100 overflow-hidden">
          <motion.div
            initial={false}
            animate={{ width: step === 1 ? '50%' : '100%' }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="h-full bg-gradient-to-r from-amber-400 to-[#FACC15]"
          />
        </div>

        {/* Modal Top Bar Navigation */}
        <div className="relative z-10 px-6 pt-5 pb-2 flex items-center justify-between">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="p-2 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          ) : (
            <div className="w-10" />
          )}

          <div className="text-[11px] font-black uppercase tracking-widest text-amber-500">
            PASSO {step} DE 2
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-6 pt-2">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              /* STEP 1: Seleção de Banco de Dados (Estilo Referência) */
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Big Centered Headline & Subtitle */}
                <div className="text-center max-w-xl mx-auto space-y-2 pt-1">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
                    Qual banco de dados você deseja conectar?
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-500">
                    Selecione o motor relacional moderno, servidor NoSQL ou sistema legado de ERP desktop.
                  </p>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 max-w-2xl mx-auto">
                  {/* Category Pills */}
                  <div className="flex gap-1.5 p-1 bg-zinc-100/80 rounded-full border border-zinc-200/60 select-none">
                    {[
                      { id: 'all', label: 'Todos (11)' },
                      { id: 'modern', label: 'Modernos & Cloud' },
                      { id: 'legacy', label: 'Bancos Legados & ERP' }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id as any)}
                        className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          activeCategory === cat.id
                            ? 'bg-white text-zinc-950 shadow-xs ring-1 ring-black/5'
                            : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Filtrar motor..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 bg-zinc-50 focus:bg-white border border-zinc-200 focus:border-amber-400 rounded-full text-xs text-zinc-900 focus:outline-none transition-all placeholder:text-zinc-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Elegant MagicCard Grid (4 Columns as in reference image) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto pt-1">
                  {filteredEngines.map(eng => {
                    const isSelected = selectedEngine.type === eng.type;
                    return (
                      <MagicCard
                        key={eng.type}
                        onClick={() => handleSelectEngine(eng)}
                        onDoubleClick={() => handleSelectAndProceed(eng)}
                        isSelected={isSelected}
                        gradientColor="#FACC15"
                        gradientSize={180}
                        className="p-4 flex flex-col items-center justify-center text-center aspect-square select-none group transition-all"
                      >
                        {/* Selected Indicator Checkmark */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}

                        {/* Centered Clean Icon */}
                        <div
                          className={`p-3 rounded-2xl mb-2.5 transition-transform group-hover:scale-105 ${
                            isSelected ? 'bg-amber-200/60' : 'bg-zinc-50 border border-zinc-100'
                          }`}
                        >
                          <DatabaseIcon type={eng.type} className="w-7 h-7" />
                        </div>

                        {/* Title & Badge */}
                        <div className="text-xs font-bold text-zinc-900 tracking-tight leading-tight line-clamp-1 mb-0.5">
                          {eng.label}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium line-clamp-1">
                          {eng.badge}
                        </div>
                      </MagicCard>
                    );
                  })}
                </div>

                {filteredEngines.length === 0 && (
                  <div className="text-center py-10 text-zinc-400 text-xs">
                    Nenhum motor de banco de dados encontrado para "{searchQuery}".
                  </div>
                )}

                {/* Centered Action Button ("Next / Continuar") */}
                <div className="flex flex-col items-center justify-center pt-2">
                  <ShinyButton
                    type="button"
                    onClick={() => setStep(2)}
                    className="min-w-[180px] text-sm py-3"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </ShinyButton>
                  <p className="text-[11px] text-zinc-400 mt-2">
                    Banco selecionado: <strong className="text-zinc-700">{selectedEngine.label}</strong> (duplo clique para avançar)
                  </p>
                </div>
              </motion.div>
            ) : (
              /* STEP 2: Configuração & Credenciais */
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="max-w-xl mx-auto space-y-5"
              >
                {/* Centered Header for Step 2 */}
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 mb-1">
                    <DatabaseIcon type={selectedEngine.type} className="w-4 h-4" />
                    <span className="text-xs font-bold text-zinc-900">{selectedEngine.label}</span>
                    <span className="text-[10px] text-amber-700 font-semibold">({selectedEngine.categoryLabel})</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
                    Configurar Conexão
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Informe os parâmetros e credenciais de acesso ao seu banco de dados.
                  </p>
                </div>

                {/* Form Card Container */}
                <form onSubmit={handleConnectSubmit} className="space-y-4">
                  {/* Connection Identification */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1">
                      Nome / Identificação da Conexão
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Banco Principal, ERP Produção..."
                      value={connName}
                      onChange={e => setConnName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 focus:bg-white border border-zinc-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 rounded-xl text-xs text-zinc-900 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Engine-Specific Configuration */}
                  {selectedEngine.type === 'firebird' ? (
                    /* Firebird Special Form */
                    <div className="space-y-3.5 p-4 rounded-2xl bg-zinc-50/70 border border-zinc-200">
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">
                          Arquivo do Banco Firebird (.FDB)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Ex: C:\Sistemas\DADOS.FDB"
                            value={database}
                            onChange={e => setDatabase(e.target.value)}
                            className="flex-1 px-3.5 py-2 bg-white border border-zinc-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleBrowseFile}
                            className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-xs font-bold text-amber-950 flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
                            <span>Arquivo</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-zinc-800 mb-1">Host / Servidor</label>
                          <input
                            type="text"
                            required
                            value={host}
                            onChange={e => setHost(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white border border-zinc-200 focus:border-amber-400 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-800 mb-1">Porta</label>
                          <input
                            type="number"
                            value={port}
                            onChange={e => setPort(Number(e.target.value))}
                            className="w-full px-3.5 py-2 bg-white border border-zinc-200 focus:border-amber-400 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-bold text-zinc-800 mb-1">Usuário</label>
                          <input
                            type="text"
                            required
                            value={user}
                            onChange={e => setUser(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white border border-zinc-200 focus:border-amber-400 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-800 mb-1">Senha</label>
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white border border-zinc-200 focus:border-amber-400 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">
                          Charset / Codificação de Caracteres
                        </label>
                        <select
                          value={charset}
                          onChange={e => setCharset(e.target.value)}
                          className="w-full px-3.5 py-2 bg-white border border-zinc-200 focus:border-amber-400 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                        >
                          <option value="WIN1252">WIN1252 (Padrão ERP / Windows-1252 - Corrige acentuação)</option>
                          <option value="ISO8859_1">ISO8859_1 (Latin 1)</option>
                          <option value="UTF8">UTF8 (Unicode Moderno)</option>
                          <option value="NONE">NONE (Binário / Legado)</option>
                        </select>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Evita caracteres corrompidos em nomes como Concórdia, São Paulo, etc.
                        </p>
                      </div>
                    </div>
                  ) : isFileBased ? (
                    /* File Based Databases */
                    <div className="space-y-3 p-4 rounded-2xl bg-zinc-50/70 border border-zinc-200">
                      <label className="block text-xs font-bold text-zinc-800 mb-1">
                        Caminho do Arquivo ou Diretório de Dados
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder={
                            selectedEngine.type === 'dbf'
                              ? 'Ex: C:\\Sistemas\\CLIENTES.DBF ou pasta com arquivos'
                              : selectedEngine.type === 'paradox'
                              ? 'Ex: C:\\Sistemas\\TABELA.DB'
                              : selectedEngine.type === 'access'
                              ? 'Ex: C:\\Dados\\banco.mdb'
                              : 'Ex: C:\\Dados\\database.sqlite'
                          }
                          value={filePath}
                          onChange={e => setFilePath(e.target.value)}
                          className="flex-1 px-3.5 py-2.5 bg-white border border-zinc-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleBrowseFile}
                          className="px-3.5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-xs font-bold text-amber-950 flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
                          <span>Arquivo</span>
                        </button>
                        {['dbf', 'paradox', 'hfsql'].includes(selectedEngine.type) && (
                          <button
                            type="button"
                            onClick={handleBrowseDir}
                            title="Selecionar pasta inteira com múltiplas tabelas"
                            className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-800 flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <span>Pasta</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        Selecione o arquivo local do banco ou a pasta contendo as tabelas do sistema ERP.
                      </p>
                    </div>
                  ) : (
                    /* Client/Server Databases */
                    <div className="space-y-3.5 p-4 rounded-2xl bg-zinc-50/70 border border-zinc-200">
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-zinc-800 mb-1">Host / Servidor</label>
                          <input
                            type="text"
                            required
                            placeholder="localhost ou IP"
                            value={host}
                            onChange={e => setHost(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white border border-zinc-200 focus:border-amber-400 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-800 mb-1">Porta</label>
                          <input
                            type="number"
                            required
                            value={port}
                            onChange={e => setPort(Number(e.target.value))}
                            className="w-full px-3.5 py-2 bg-white border border-zinc-200 focus:border-amber-400 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-bold text-zinc-800 mb-1">Usuário</label>
                          <input
                            type="text"
                            placeholder="postgres, root, sa..."
                            value={user}
                            onChange={e => setUser(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white border border-zinc-200 focus:border-amber-400 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-800 mb-1">Senha</label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white border border-zinc-200 focus:border-amber-400 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Database Selection with "Buscar Databases" */}
                      <div className="pt-2 border-t border-zinc-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-zinc-600" />
                            <span>Banco de Dados (Database)</span>
                          </label>

                          {/* Action Button: Buscar Databases */}
                          <button
                            type="button"
                            onClick={handleFetchDatabases}
                            disabled={isFetchingDatabases || !host}
                            className="px-3 py-1 rounded-full bg-amber-100 hover:bg-amber-200 border border-amber-300 text-xs font-bold text-amber-950 flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${isFetchingDatabases ? 'animate-spin' : ''}`} />
                            <span>{isFetchingDatabases ? 'Buscando...' : 'Buscar Databases'}</span>
                          </button>
                        </div>

                        {/* Discovered databases list */}
                        {discoveredDatabases.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{discoveredDatabases.length} bancos disponíveis no servidor:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {discoveredDatabases.map(db => (
                                <button
                                  key={db}
                                  type="button"
                                  onClick={() => setDatabase(db)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                    database === db
                                      ? 'bg-[#FACC15] text-zinc-950 font-bold shadow-xs ring-1 ring-amber-400'
                                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                                  }`}
                                >
                                  {db}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <input
                          type="text"
                          required
                          placeholder="Digite o nome do banco ou selecione acima..."
                          value={database}
                          onChange={e => setDatabase(e.target.value)}
                          className="w-full px-3.5 py-2 bg-white border border-zinc-200 focus:border-amber-400 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none"
                        />

                        {databaseSearchError && (
                          <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                            <span>{databaseSearchError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Test Status Banner */}
                  {testResult && (
                    <div
                      className={`p-3 rounded-2xl text-xs flex items-center gap-2 border ${
                        testResult.success
                          ? 'bg-amber-50 text-amber-900 border-amber-300 font-semibold'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      )}
                      <span className="truncate">{testResult.message}</span>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2.5 rounded-full border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Voltar</span>
                    </button>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleTest}
                        disabled={isTesting}
                        className="px-4 py-2.5 rounded-full border border-zinc-200 bg-white text-xs font-bold text-zinc-800 hover:bg-zinc-50 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
                      </button>

                      <ShinyButton
                        type="submit"
                        disabled={isConnecting}
                        className="text-xs py-2.5 px-6"
                      >
                        <span>{isConnecting ? 'Conectando...' : 'Salvar & Conectar'}</span>
                      </ShinyButton>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default ConnectionDrawer;
