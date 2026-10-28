import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Cpu,
  HardDrive,
  FolderOpen,
  ArrowRight,
  Database
} from 'lucide-react';
import { DetectedService, PortableToolStatus } from '@shared/types/database';
import { safeApi } from '../../services/api-client';

interface ServerManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerManagerDrawer: React.FC<ServerManagerDrawerProps> = ({ isOpen, onClose }) => {
  const [services, setServices] = useState<DetectedService[]>([]);
  const [tools, setTools] = useState<PortableToolStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingToolId, setDownloadingToolId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const [detected, portableTools] = await Promise.all([
        safeApi.detectServices(),
        safeApi.getPortableToolsStatus()
      ]);
      setServices(detected);
      setTools(portableTools);
    } catch (err: any) {
      setStatusMessage(`Erro ao escanear serviços: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleDownloadTool = async (toolId: string) => {
    setDownloadingToolId(toolId);
    setStatusMessage(null);
    try {
      const msg = await safeApi.downloadPortableTool(toolId);
      setStatusMessage(msg);
      await loadData();
    } catch (err: any) {
      setStatusMessage(`Erro no download: ${err?.message || err}`);
    } finally {
      setDownloadingToolId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
                Serviços de Banco & Dependências
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detecção automática de servidores locais e utilitários portáteis DadData
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Re-escanear serviços"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {statusMessage && (
            <div className="p-3.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-xs text-violet-700 dark:text-violet-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Section 1: Detected Services */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Servidores Locais no Computador
              </h4>
              <span className="text-[11px] text-slate-400">
                {services.filter(s => s.status === 'running').length} ativos no momento
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {services.map(srv => {
                const isRunning = srv.status === 'running';
                const isStopped = srv.status === 'stopped';
                return (
                  <div
                    key={srv.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                          {srv.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                            isRunning
                              ? 'bg-emerald-500'
                              : isStopped
                              ? 'bg-amber-500'
                              : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {srv.name}
                          </span>
                          {srv.port && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                              Porta {srv.port}
                            </span>
                          )}
                          {srv.isPortable && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                              Embutido Nativo
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>
                            {isRunning
                              ? 'Serviço Ativo e Respondendo'
                              : isStopped
                              ? 'Instalado (Serviço Parado)'
                              : 'Não Detectado'}
                          </span>
                          {srv.version && <span>• {srv.version}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {Object.keys(srv.tools).length > 0 ? (
                        <span className="px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                          CLI {Object.keys(srv.tools).join(', ')} disponível
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Sem CLI local</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Portable Dependencies / Provisioner */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Utilitários Portáteis DadData (Zero Instalação)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Baixe ferramentas oficiais para executar backup e restauração sem precisar instalar o servidor completo
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {tools.map(tool => {
                const isDownloading = downloadingToolId === tool.id;
                return (
                  <div
                    key={tool.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {tool.name}
                          </span>
                          {tool.version && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({tool.version})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {tool.isInstalled
                            ? `Pronto para uso (${tool.path || 'Instalado'})`
                            : `Disponível para download (~${Math.round((tool.sizeBytes || 0) / 1024 / 1024)} MB)`}
                        </p>
                      </div>
                    </div>

                    <div>
                      {tool.isInstalled ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Pronto
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDownloadTool(tool.id)}
                          disabled={isDownloading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors shadow-sm disabled:opacity-50"
                        >
                          <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                          {isDownloading ? 'Baixando...' : 'Baixar Agora'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500">
          <span>O DadData prioriza automaticamente os serviços locais já existentes na máquina.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
