import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Database,
  Server,
  Archive,
  Code2,
  Pencil,
  Trash2,
  ArrowRight,
  Sparkles,
  Clock,
  Folder,
  HardDrive,
  CheckCircle2,
  Layers,
  Filter,
  Check,
  Play
} from 'lucide-react';
import { ConnectionConfig, DatabaseType } from '@shared/types/database';
import { DatabaseIcon } from '../icons/DatabaseIcon';
import { MagicCard } from '../magicui/magic-card';
import { ShinyButton } from '../magicui/shiny-button';

interface HomeViewProps {
  savedConnections: ConnectionConfig[];
  activeConnection: ConnectionConfig | null;
  onConnect: (conn: ConnectionConfig) => void;
  onEditConnection: (conn: ConnectionConfig) => void;
  onDeleteConnection: (connId: string) => void;
  onOpenNewConnection: () => void;
  onOpenNewQuery: () => void;
  onOpenBackup: () => void;
  onOpenServices: () => void;
  isLoading?: boolean;
}

const SERVER_TYPES: DatabaseType[] = ['postgres', 'mysql', 'mssql', 'firebird', 'mongodb'];
const FILE_TYPES: DatabaseType[] = ['paradox', 'nexusdb', 'access', 'dbf', 'sqlite', 'hfsql'];

export const HomeView: React.FC<HomeViewProps> = ({
  savedConnections,
  activeConnection,
  onConnect,
  onEditConnection,
  onDeleteConnection,
  onOpenNewConnection,
  onOpenNewQuery,
  onOpenBackup,
  onOpenServices,
  isLoading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'servers' | 'files'>('all');
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Filter connections
  const filteredConnections = useMemo(() => {
    return savedConnections.filter(conn => {
      const matchesSearch =
        conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conn.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (conn.host && conn.host.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (conn.database && conn.database.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (conn.filePath && conn.filePath.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (conn.directoryPath && conn.directoryPath.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (selectedCategory === 'servers') {
        return SERVER_TYPES.includes(conn.type);
      }
      if (selectedCategory === 'files') {
        return FILE_TYPES.includes(conn.type);
      }
      return true;
    });
  }, [savedConnections, searchQuery, selectedCategory]);

  const handleCardConnect = async (conn: ConnectionConfig) => {
    setConnectingId(conn.id);
    try {
      await onConnect(conn);
    } finally {
      setConnectingId(null);
    }
  };

  const serverCount = savedConnections.filter(c => SERVER_TYPES.includes(c.type)).length;
  const fileCount = savedConnections.filter(c => FILE_TYPES.includes(c.type)).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-gradient-to-b from-white via-zinc-50/50 to-zinc-100/50 p-6 md:p-8 select-none">
      <div className="max-w-7xl mx-auto w-full space-y-7">
        {/* Top Hero / Welcome Banner — Inspired by MySQL Workbench */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white p-7 md:p-9 shadow-lg border border-zinc-800">
          {/* Subtle gold glow behind header */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 rounded-full bg-yellow-400/5 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-bold tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>DadData Studio • Central de Conexões</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Bem-vindo ao DadData
              </h1>
              <p className="text-zinc-400 text-xs md:text-sm max-w-2xl leading-relaxed">
                Ambiente unificado para gerenciamento, exploração e consultas SQL de bancos modernos (PostgreSQL, MySQL, SQL Server) e bases legadas desktop (Paradox, NexusDB, Access, Firebird, DBF).
              </p>
            </div>

            {/* Quick Action Button */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={onOpenNewConnection}
                className="h-10 px-5 rounded-full bg-[#FACC15] hover:bg-amber-400 text-zinc-950 font-bold text-xs md:text-sm flex items-center gap-2 shadow-md hover:shadow-amber-400/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Nova Conexão</span>
              </button>
            </div>
          </div>

          {/* Quick stats counter */}
          <div className="relative z-10 mt-6 pt-5 border-t border-zinc-800/80 flex flex-wrap items-center gap-6 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
              <span>
                <strong className="text-white font-mono">{savedConnections.length}</strong> conexões salvas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span>
                <strong className="text-white font-mono">{serverCount}</strong> servidores de rede
              </span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>
                <strong className="text-white font-mono">{fileCount}</strong> bases de arquivos locais
              </span>
            </div>
            {activeConnection && (
              <div className="ml-auto inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ativo: {activeConnection.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Connections Section Header & Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-zinc-800" />
              <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
                Conexões Recentes e Salvas
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-zinc-200/80 text-zinc-700">
                {filteredConnections.length}
              </span>
            </div>

            {/* Filter Category Tabs */}
            <div className="flex items-center gap-1.5 bg-zinc-200/60 p-1 rounded-2xl text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-white text-zinc-950 shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                Todas ({savedConnections.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('servers')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  selectedCategory === 'servers'
                    ? 'bg-white text-zinc-950 shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                Servidores ({serverCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('files')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  selectedCategory === 'files'
                    ? 'bg-white text-zinc-950 shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                Arquivos / ERP ({fileCount})
              </button>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar conexões por nome, host, base de dados ou tipo (ex: postgres, paradox, localhost)..."
              className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border border-zinc-200 text-xs md:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 shadow-xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Connections Grid — MySQL Workbench tile style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Card 0: "Nova Conexão" Action Card */}
          <div
            onClick={onOpenNewConnection}
            className="group relative rounded-2xl border-2 border-dashed border-zinc-300 hover:border-amber-400 bg-white/70 hover:bg-amber-50/40 p-5 flex flex-col items-center justify-center text-center gap-3 transition-all cursor-pointer min-h-[175px] shadow-2xs hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 group-hover:bg-[#FACC15] group-hover:scale-110 flex items-center justify-center transition-all shadow-xs text-zinc-900">
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 group-hover:text-amber-900 transition-colors">
                Criar Nova Conexão
              </h3>
              <p className="text-[11px] text-zinc-500 max-w-[210px] mt-1">
                Conectar a servidores remotos ou arquivos locais de ERP
              </p>
            </div>
          </div>

          {/* Saved Connection Cards */}
          {filteredConnections.map(conn => {
            const isCurrentActive = activeConnection?.id === conn.id;
            const isConnecting = connectingId === conn.id;
            const isServer = SERVER_TYPES.includes(conn.type);

            return (
              <MagicCard
                key={conn.id}
                onClick={() => handleCardConnect(conn)}
                isSelected={isCurrentActive}
                className="group p-5 flex flex-col justify-between min-h-[175px] shadow-2xs hover:shadow-md border border-zinc-200/90 hover:border-amber-400/60"
              >
                {/* Card Top: Database Icon, Type badge, and Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center p-2 group-hover:scale-105 transition-transform flex-shrink-0 border border-zinc-200/60">
                      <DatabaseIcon type={conn.type} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-mono font-extrabold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200/70 inline-block">
                        {conn.type}
                      </span>
                      {isCurrentActive && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Ativo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Context Actions (Edit / Delete) */}
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onEditConnection(conn)}
                      title="Editar Conexão"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteConnection(conn.id)}
                      title="Excluir Conexão"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Body: Connection Name & Details */}
                <div className="my-3 space-y-1">
                  <h3 className="font-bold text-sm text-zinc-900 group-hover:text-amber-900 transition-colors truncate" title={conn.name}>
                    {conn.name}
                  </h3>

                  {isServer ? (
                    <p className="text-xs text-zinc-500 font-mono truncate" title={`${conn.user || 'default'}@${conn.host || 'localhost'}:${conn.port || ''} / ${conn.database || ''}`}>
                      {conn.host || 'localhost'}:{conn.port || (conn.type === 'postgres' ? 5432 : conn.type === 'mysql' ? 3306 : 1433)}
                      {conn.database ? ` / ${conn.database}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500 font-mono truncate flex items-center gap-1" title={conn.filePath || conn.directoryPath}>
                      <Folder className="w-3 h-3 flex-shrink-0 text-amber-500" />
                      <span className="truncate">{conn.filePath || conn.directoryPath || 'Diretório configurado'}</span>
                    </p>
                  )}
                </div>

                {/* Card Bottom: Last access & Connect button */}
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    <span>{conn.lastConnectedAt ? new Date(conn.lastConnectedAt).toLocaleDateString() : 'Pronto'}</span>
                  </span>

                  <button
                    type="button"
                    disabled={isConnecting || isLoading}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white group-hover:bg-[#FACC15] group-hover:text-zinc-950 transition-all cursor-pointer"
                  >
                    {isConnecting ? (
                      <span>Conectando...</span>
                    ) : (
                      <>
                        <span>{isCurrentActive ? 'Abrir' : 'Conectar'}</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </MagicCard>
            );
          })}
        </div>

        {/* Empty Search State */}
        {filteredConnections.length === 0 && searchQuery && (
          <div className="p-8 text-center bg-white rounded-3xl border border-zinc-200 space-y-3">
            <Database className="w-8 h-8 text-zinc-400 mx-auto" />
            <h3 className="font-bold text-sm text-zinc-800">Nenhuma conexão encontrada para "{searchQuery}"</h3>
            <p className="text-xs text-zinc-500">Tente buscar por outro termo ou limpe o filtro.</p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-1.5 rounded-full text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 cursor-pointer"
            >
              Limpar Busca
            </button>
          </div>
        )}

        {/* Workbench Utilities / Quick Management Cards */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-700" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
              Ferramentas e Rotinas do Sistema (Abas de Trabalho)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Utility 1: Backup & Restauração */}
            <div
              onClick={onOpenBackup}
              className="p-5 rounded-2xl bg-white border border-zinc-200/90 hover:border-amber-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Archive className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-zinc-900 group-hover:text-amber-900">
                  Backup & Restauração de Bancos
                </h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Gere cópias de segurança confiáveis (.sql, .bak, .zip) ou restaure dados com terminal streaming em tempo real.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center text-xs font-bold text-amber-600 group-hover:text-amber-700">
                <span>Abrir Aba de Backup</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Utility 2: Serviços e Utilitários Portáteis */}
            <div
              onClick={onOpenServices}
              className="p-5 rounded-2xl bg-white border border-zinc-200/90 hover:border-violet-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Server className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-zinc-900 group-hover:text-violet-900">
                  Serviços Locais & Ferramentas CLI
                </h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Detecção automática de instâncias em execução (Postgres, MySQL, SQL Server) e download de ferramentas portáteis.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center text-xs font-bold text-violet-600 group-hover:text-violet-700">
                <span>Gerenciar Serviços</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Utility 3: Nova Consulta SQL */}
            <div
              onClick={onOpenNewQuery}
              className="p-5 rounded-2xl bg-white border border-zinc-200/90 hover:border-emerald-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Code2 className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-zinc-900 group-hover:text-emerald-900">
                  Editor SQL Direto
                </h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Abra uma nova aba de consulta SQL com realce de sintaxe, auto-formatação e verificação de regras para o banco atual.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center text-xs font-bold text-emerald-600 group-hover:text-emerald-700">
                <span>Nova Consulta SQL</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Supported Database Engines */}
        <div className="pt-2 pb-6 border-t border-zinc-200/80 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
          <span className="font-medium">
            Motores Suportados Nativamente:
          </span>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
            {['PostgreSQL', 'MySQL', 'SQL Server', 'Firebird', 'Paradox', 'NexusDB', 'MS Access', 'DBF', 'SQLite', 'HFSQL', 'MongoDB'].map(engine => (
              <span key={engine} className="px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-700 font-semibold">
                {engine}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeView;
