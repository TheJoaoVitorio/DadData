import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Database,
  Archive,
  Terminal,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Play,
  RotateCcw,
  HardDrive,
  Cpu,
  Layers,
  ChevronRight,
  Sparkles
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

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'backup' | 'restore';
  connection: ConnectionConfig | null;
  defaultDatabase?: string;
  defaultTable?: string;
  onSuccess?: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  mode: initialMode,
  connection,
  defaultDatabase,
  defaultTable,
  onSuccess
}) => {
  const [mode, setMode] = useState<'backup' | 'restore'>(initialMode);
  const [databaseName, setDatabaseName] = useState(defaultDatabase || connection?.database || 'postgres');
  const [filePath, setFilePath] = useState('');
  const [format, setFormat] = useState<'sql' | 'custom' | 'tar' | 'zip' | 'bak'>('sql');
  const [dumpType, setDumpType] = useState<'full' | 'schema_only' | 'data_only'>('full');
  const [dropExisting, setDropExisting] = useState(false);

  // Environment and tools
  const [detectedServices, setDetectedServices] = useState<DetectedService[]>([]);
  const [portableTools, setPortableTools] = useState<PortableToolStatus[]>([]);
  const [usePortableTool, setUsePortableTool] = useState(false);

  // Execution & Logs
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(true);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [progress, setProgress] = useState(0);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

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

  // Load environment services
  useEffect(() => {
    if (isOpen) {
      safeApi.detectServices().then(setDetectedServices).catch(console.error);
      safeApi.getPortableToolsStatus().then(setPortableTools).catch(console.error);
      setLogs([]);
      setIsRunning(false);
      setIsCompleted(false);
      setProgress(0);
    }
  }, [isOpen]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!isOpen || !connection) return null;

  const currentService = detectedServices.find(s => s.id === (connection?.type || '').toLowerCase());
  const hasLocalCli = currentService && Object.keys(currentService.tools).length > 0;

  const handlePickFile = async () => {
    if (mode === 'backup') {
      const ext = format === 'custom' ? 'dump' : format;
      const defaultName = `${databaseName}_backup_${new Date().toISOString().slice(0, 10)}.${ext}`;
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
          connectionId: connection?.id || '',
          databaseName,
          outputPath: filePath,
          format,
          dumpType,
          dropExisting
        };
        await safeApi.startBackup(options);
      } else {
        const options: RestoreOptions = {
          connectionId: connection?.id || '',
          databaseName,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${mode === 'backup' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
                  {mode === 'backup' ? 'Assistente de Backup de Banco de Dados' : 'Assistente de Restauração de Banco'}
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {connection?.name || 'Conexão'} ({connection?.type || 'DB'})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'backup'
                  ? 'Gere cópias de segurança confiáveis com compressão e compatibilidade nativa'
                  : 'Restaure esquemas e registros diretamente no servidor ou arquivo local'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
              <button
                onClick={() => setMode('backup')}
                disabled={isRunning}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  mode === 'backup'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Backup
              </button>
              <button
                onClick={() => setMode('restore')}
                disabled={isRunning}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  mode === 'restore'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Restaurar
              </button>
            </div>
            <button
              onClick={onClose}
              disabled={isRunning}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {/* Environment Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <Cpu className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Motor & Ambiente Detectado
                  </span>
                  {currentService?.status === 'running' ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Serviço Local Ativo ({currentService.port ? `Porta ${currentService.port}` : 'Nativo'})
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                      Modo Autônomo / Portátil
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {hasLocalCli
                    ? `Ferramenta CLI oficial disponível: ${Object.values(currentService?.tools || {}).join(', ')}`
                    : 'DadData utilizará motor de exportação streaming nativo ou utilitário portátil.'}
                </p>
              </div>
            </div>
          </div>

          {/* Form Options */}
          <div className="grid grid-cols-2 gap-4">
            {/* Database Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Banco de Dados Alvo
              </label>
              <input
                type="text"
                value={databaseName}
                onChange={e => setDatabaseName(e.target.value)}
                disabled={isRunning}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                placeholder="Nome do banco de dados"
              />
            </div>

            {/* Format Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Formato do Arquivo
              </label>
              <select
                value={format}
                onChange={e => setFormat(e.target.value as any)}
                disabled={isRunning}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="sql">Script SQL Texto (.sql)</option>
                <option value="custom">Arquivo Binário Custom (.dump / .backup)</option>
                <option value="tar">Arquivo Tar (.tar)</option>
                <option value="zip">Pacote Compactado (.zip - Legados/Desktop)</option>
                <option value="bak">Nativo SQL Server (.bak)</option>
              </select>
            </div>
          </div>

          {/* Path Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {mode === 'backup' ? 'Arquivo de Destino' : 'Arquivo de Origem para Restauração'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={filePath}
                onChange={e => setFilePath(e.target.value)}
                disabled={isRunning}
                placeholder={mode === 'backup' ? 'Clique em Procurar para escolher onde salvar o backup...' : 'Clique em Procurar para selecionar o arquivo de backup...'}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <button
                onClick={handlePickFile}
                disabled={isRunning}
                className="px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Procurar...
              </button>
            </div>
          </div>

          {/* Dump Type & Flags */}
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Opções de Estrutura e Dados
            </span>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="radio"
                  name="dumpType"
                  value="full"
                  checked={dumpType === 'full'}
                  onChange={() => setDumpType('full')}
                  disabled={isRunning}
                  className="accent-amber-500"
                />
                Completo (Estrutura DDL + Dados)
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="radio"
                  name="dumpType"
                  value="schema_only"
                  checked={dumpType === 'schema_only'}
                  onChange={() => setDumpType('schema_only')}
                  disabled={isRunning}
                  className="accent-amber-500"
                />
                Somente Estrutura (DDL)
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="radio"
                  name="dumpType"
                  value="data_only"
                  checked={dumpType === 'data_only'}
                  onChange={() => setDumpType('data_only')}
                  disabled={isRunning}
                  className="accent-amber-500"
                />
                Somente Registros (Dados)
              </label>
            </div>

            <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center gap-2">
              <input
                type="checkbox"
                id="dropExisting"
                checked={dropExisting}
                onChange={e => setDropExisting(e.target.checked)}
                disabled={isRunning}
                className="rounded text-amber-500 focus:ring-amber-500/20"
              />
              <label htmlFor="dropExisting" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                {mode === 'backup'
                  ? 'Incluir comandos DROP TABLE antes de CREATE TABLE'
                  : 'Recriar tabelas antes da restauração (Limpar dados existentes)'}
              </label>
            </div>
          </div>

          {/* Live Log Terminal */}
          {(isRunning || logs.length > 0) && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 text-slate-200 font-mono text-xs overflow-hidden shadow-inner">
              <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-semibold text-slate-300">
                    Console de Execução em Tempo Real
                  </span>
                </div>
                {isRunning && (
                  <span className="text-[10px] text-amber-400 animate-pulse font-sans font-medium">
                    Processando...
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-900 h-1">
                <div
                  className="bg-amber-500 h-1 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="p-3.5 max-h-44 overflow-y-auto space-y-1 selection:bg-amber-500/30">
                {logs.map((l, idx) => (
                  <div key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-600 select-none text-[10px] pt-0.5">[{l.timestamp}]</span>
                    <span
                      className={`break-all ${
                        l.stream === 'stderr' || l.stream === 'error'
                          ? 'text-rose-400'
                          : l.stream === 'stdout'
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {l.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            {isCompleted && (
              <div className="flex items-center gap-1.5 text-xs">
                {isSuccess ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Processo finalizado com sucesso!
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Ocorreu um erro durante o processo.
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isRunning}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleExecute}
              disabled={isRunning || !filePath}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-medium text-white shadow-sm transition-all disabled:opacity-50 ${
                mode === 'backup'
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              }`}
            >
              <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning
                ? 'Executando...'
                : mode === 'backup'
                ? 'Iniciar Backup'
                : 'Iniciar Restauração'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
