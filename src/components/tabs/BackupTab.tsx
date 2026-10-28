import React, { useState, useEffect, useRef } from 'react';
import {
  Archive,
  RotateCcw,
  Play,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Database,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import {
  ConnectionConfig,
  BackupOptions,
  RestoreOptions,
  LogEvent,
  DetectedService,
  PortableToolStatus
} from '@shared/types/database';
import { safeApi } from '../../services/api-client';
import { DatabaseIcon } from '../icons/DatabaseIcon';

interface BackupTabProps {
  connection: ConnectionConfig | null;
  savedConnections?: ConnectionConfig[];
  defaultDatabase?: string;
  defaultTable?: string;
  initialMode?: 'backup' | 'restore';
  onSwitchConnection?: (conn: ConnectionConfig) => void;
  onSuccess?: () => void;
}

export const BackupTab: React.FC<BackupTabProps> = ({
  connection,
  savedConnections = [],
  defaultDatabase,
  defaultTable,
  initialMode = 'backup',
  onSwitchConnection,
  onSuccess
}) => {
  const [mode, setMode] = useState<'backup' | 'restore'>(initialMode);
  const [databaseName, setDatabaseName] = useState(defaultDatabase || connection?.database || '');
  const [filePath, setFilePath] = useState('');
  const [format, setFormat] = useState<'sql' | 'custom' | 'tar' | 'zip' | 'bak'>('sql');
  const [dumpType, setDumpType] = useState<'full' | 'schema_only' | 'data_only'>('full');
  const [dropExisting, setDropExisting] = useState(false);

  // Environment & portable tools
  const [detectedServices, setDetectedServices] = useState<DetectedService[]>([]);
  const [portableTools, setPortableTools] = useState<PortableToolStatus[]>([]);

  // Execution & Logs
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(true);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [progress, setProgress] = useState(0);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultDatabase) {
      setDatabaseName(defaultDatabase);
    } else if (connection?.database) {
      setDatabaseName(connection.database);
    }
  }, [defaultDatabase, connection]);

  // Set default format based on connection db_type
  useEffect(() => {
    if (!connection) return;
    const type = connection.type.toLowerCase();
    if (type.includes('postgres')) {
      setFormat('sql');
    } else if (type.includes('mysql')) {
      setFormat('sql');
    } else if (type.includes('mssql')) {
      setFormat('bak');
    } else if (['dbf', 'paradox', 'access', 'nexusdb'].includes(type)) {
      setFormat('zip');
    } else {
      setFormat('sql');
    }
  }, [connection]);

  // Load environment services on mount
  useEffect(() => {
    safeApi.detectServices().then(setDetectedServices).catch(console.error);
    safeApi.getPortableToolsStatus().then(setPortableTools).catch(console.error);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const currentService = detectedServices.find(s => s.id === (connection?.type || '').toLowerCase());
  const hasLocalCli = currentService && Object.keys(currentService.tools).length > 0;

  const handlePickFile = async () => {
    if (mode === 'backup') {
      const ext = format === 'custom' ? 'dump' : format;
      const defaultName = `${databaseName || 'backup'}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      const chosen = await safeApi.saveFileDialog(defaultName, ext);
      if (chosen) setFilePath(chosen);
    } else {
      const ext = format === 'custom' ? 'dump' : format;
      const chosen = await safeApi.openFileDialog([
        { name: 'Arquivos de Backup', extensions: [ext, 'sql', 'dump', 'backup', 'zip', 'bak', 'fbk'] }
      ]);
      if (chosen) setFilePath(chosen);
    }
  };

  const handleExecute = async () => {
    if (!connection) {
      alert('Selecione ou conecte-se a um banco de dados primeiro.');
      return;
    }
    if (!filePath) {
      alert(mode === 'backup' ? 'Selecione o arquivo de destino para o backup.' : 'Selecione o arquivo de origem para restaurar.');
      return;
    }

    setIsRunning(true);
    setIsCompleted(false);
    setLogs([]);
    setProgress(10);

    // Subscribe to logs
    let unlisten: (() => void) | null = null;
    if (mode === 'backup') {
      unlisten = await safeApi.onBackupLog(log => {
        setLogs(prev => [...prev, log]);
        if (log.percentage !== undefined && log.percentage !== null) {
          setProgress(log.percentage);
        }
        if (log.isDone) {
          setIsRunning(false);
          setIsCompleted(true);
          setIsSuccess(log.success);
        }
      });
    } else {
      unlisten = await safeApi.onRestoreLog(log => {
        setLogs(prev => [...prev, log]);
        if (log.percentage !== undefined && log.percentage !== null) {
          setProgress(log.percentage);
        }
        if (log.isDone) {
          setIsRunning(false);
          setIsCompleted(true);
          setIsSuccess(log.success);
        }
      });
    }

    try {
      if (mode === 'backup') {
        const options: BackupOptions = {
          connectionId: connection.id,
          databaseName: databaseName || connection.database,
          outputPath: filePath,
          format,
          dumpType,
          dropExisting
        };
        await safeApi.startBackup(options);
      } else {
        const options: RestoreOptions = {
          connectionId: connection.id,
          databaseName: databaseName || connection.database,
          inputPath: filePath,
          format,
          dropFirst: dropExisting
        };
        await safeApi.startRestore(options);
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setLogs(prev => [
        ...prev,
        {
          stream: 'error',
          message: `Falha na execução: ${err?.message || err}`,
          timestamp: new Date().toLocaleTimeString(),
          isDone: true,
          success: false
        }
      ]);
      setIsRunning(false);
      setIsCompleted(true);
      setIsSuccess(false);
    } finally {
      if (unlisten) unlisten();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-50/60 p-5 md:p-6 overflow-y-auto select-none">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl ${mode === 'backup' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {mode === 'backup' ? <Archive className="w-6 h-6" /> : <RotateCcw className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900">
                  {mode === 'backup' ? 'Assistente de Backup de Banco de Dados' : 'Assistente de Restauração de Banco'}
                </h2>
                {connection && (
                  <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                    {connection.name} ({connection.type})
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {mode === 'backup'
                  ? 'Gere cópias de segurança confiáveis com compressão e compatibilidade nativa'
                  : 'Restaure esquemas e registros diretamente no servidor ou arquivo local'}
              </p>
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode('backup')}
              disabled={isRunning}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'backup'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-950'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-amber-500" />
              <span>Fazer Backup</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('restore')}
              disabled={isRunning}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'restore'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-950'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
              <span>Restaurar</span>
            </button>
          </div>
        </div>

        {/* If no connection is active, prompt to select one */}
        {!connection && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Nenhum banco de dados ativo no momento. Selecione uma conexão salva para continuar:</span>
            </div>
            {savedConnections.length > 0 && onSwitchConnection && (
              <select
                onChange={e => {
                  const conn = savedConnections.find(c => c.id === e.target.value);
                  if (conn) onSwitchConnection(conn);
                }}
                className="px-3 py-1 bg-white border border-amber-300 rounded-xl text-xs font-bold text-zinc-800"
              >
                <option value="">Selecione uma conexão...</option>
                {savedConnections.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Main Content Layout: Configuration (Left) & Terminal / Status (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Settings & Configuration */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-xs space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-400">
                Parâmetros do {mode === 'backup' ? 'Backup' : 'Restore'}
              </h3>

              {/* Target Database Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Banco de Dados Alvo</label>
                <input
                  type="text"
                  value={databaseName}
                  onChange={e => setDatabaseName(e.target.value)}
                  disabled={isRunning}
                  placeholder="Nome do banco de dados..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>

              {/* Destination / Source File */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">
                  {mode === 'backup' ? 'Arquivo de Destino' : 'Arquivo de Origem'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filePath}
                    onChange={e => setFilePath(e.target.value)}
                    disabled={isRunning}
                    placeholder={mode === 'backup' ? 'Caminho do arquivo de saída...' : 'Selecione o arquivo de backup...'}
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 truncate"
                  />
                  <button
                    type="button"
                    onClick={handlePickFile}
                    disabled={isRunning}
                    className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                    <span>Procurar</span>
                  </button>
                </div>
              </div>

              {/* Format selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Formato do Arquivo</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'sql', label: 'Script SQL (.sql)' },
                    { id: 'bak', label: 'Backup Nativo (.bak)' },
                    { id: 'zip', label: 'Pacote ZIP (.zip)' },
                    { id: 'custom', label: 'Custom pg_dump' },
                    { id: 'tar', label: 'Arquivo TAR' }
                  ].map(fmt => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setFormat(fmt.id as any)}
                      disabled={isRunning}
                      className={`px-2.5 py-2 rounded-xl text-left text-xs font-medium border transition-all cursor-pointer ${
                        format === fmt.id
                          ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold shadow-2xs'
                          : 'border-zinc-200 hover:border-zinc-300 text-zinc-700 bg-zinc-50/50'
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dump Type */}
              {mode === 'backup' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Conteúdo a Exportar</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'full', label: 'Completo (Esquema + Dados)' },
                      { id: 'schema_only', label: 'Apenas Esquema (DDL)' },
                      { id: 'data_only', label: 'Apenas Dados (INSERTs)' }
                    ].map(dt => (
                      <button
                        key={dt.id}
                        type="button"
                        onClick={() => setDumpType(dt.id as any)}
                        disabled={isRunning}
                        className={`px-2.5 py-2 rounded-xl text-left text-[11px] leading-tight border transition-all cursor-pointer ${
                          dumpType === dt.id
                            ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold shadow-2xs'
                            : 'border-zinc-200 hover:border-zinc-300 text-zinc-700 bg-zinc-50/50'
                        }`}
                      >
                        {dt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Drop existing checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={dropExisting}
                  onChange={e => setDropExisting(e.target.checked)}
                  disabled={isRunning}
                  className="rounded text-amber-500 focus:ring-amber-400"
                />
                <span className="text-xs text-zinc-700">
                  {mode === 'backup'
                    ? 'Adicionar comandos DROP TABLE / DATABASE no script gerado'
                    : 'Limpar tabelas existentes antes de importar os registros'}
                </span>
              </label>

              {/* CLI Status notice */}
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-[11px] text-zinc-600 space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span>Mecanismo de Execução:</span>
                  <span className="font-mono text-amber-600">
                    {hasLocalCli ? 'Utilitário Nativo Local' : 'DadData Portable Engine'}
                  </span>
                </div>
                <p className="text-zinc-500">
                  {hasLocalCli
                    ? 'O DadData utilizará os binários oficiais detectados na sua máquina.'
                    : 'O DadData utilizará o motor integrado para processamento direto e streaming.'}
                </p>
              </div>

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleExecute}
                disabled={isRunning || !connection}
                className="w-full h-11 rounded-2xl bg-[#FACC15] hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-amber-400/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{mode === 'backup' ? 'Gerando Backup...' : 'Restaurando...'}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-zinc-950" />
                    <span>{mode === 'backup' ? 'Iniciar Backup Agora' : 'Iniciar Restauração Agora'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Execution Status, Progress & Live Terminal Logs */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* Status & Progress Bar */}
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-zinc-600" />
                  <h3 className="font-bold text-xs text-zinc-800">
                    Status da Operação
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {isRunning && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      Em Execução
                    </span>
                  )}
                  {isCompleted && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {isSuccess ? 'Concluído com Sucesso' : 'Falha na Operação'}
                    </span>
                  )}
                  {!isRunning && !isCompleted && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500">
                      Aguardando Início
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono font-semibold text-zinc-500">
                  <span>Progresso</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Terminal Live Logs */}
            <div className="flex-1 min-h-[340px] bg-zinc-950 rounded-2xl p-4 flex flex-col font-mono text-xs text-zinc-100 shadow-inner border border-zinc-900 overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-800 flex-shrink-0 text-zinc-400 text-[11px]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                  </div>
                  <span>Saída do Processo (Streaming em Tempo Real)</span>
                </div>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    Limpar Logs
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                {logs.length === 0 ? (
                  <p className="text-zinc-600 italic py-6 text-center">
                    Nenhum log gerado ainda. Configure os parâmetros e clique em iniciar.
                  </p>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-zinc-500 text-[10px] select-none flex-shrink-0">
                        [{log.timestamp}]
                      </span>
                      <span
                        className={`break-all ${
                          log.stream === 'error'
                            ? 'text-rose-400'
                            : log.stream === 'stderr'
                            ? 'text-amber-300'
                            : 'text-zinc-300'
                        }`}
                      >
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupTab;
