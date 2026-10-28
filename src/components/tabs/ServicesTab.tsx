import React, { useState, useEffect } from 'react';
import {
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
  Database,
  Check,
  Terminal,
  Activity
} from 'lucide-react';
import { DetectedService, PortableToolStatus } from '@shared/types/database';
import { safeApi } from '../../services/api-client';
import { DatabaseIcon } from '../icons/DatabaseIcon';

interface ServicesTabProps {
  onConnectService?: (service: DetectedService) => void;
}

export const ServicesTab: React.FC<ServicesTabProps> = ({ onConnectService }) => {
  const [services, setServices] = useState<DetectedService[]>([]);
  const [tools, setTools] = useState<PortableToolStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingToolId, setDownloadingToolId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

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
      setStatusMessage({ text: `Erro ao escanear serviços: ${err?.message || err}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDownloadTool = async (toolId: string) => {
    setDownloadingToolId(toolId);
    setStatusMessage(null);
    try {
      const msg = await safeApi.downloadPortableTool(toolId);
      setStatusMessage({ text: msg, type: 'success' });
      await loadData();
    } catch (err: any) {
      setStatusMessage({ text: `Erro no download: ${err?.message || err}`, type: 'error' });
    } finally {
      setDownloadingToolId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-50/60 p-5 md:p-6 overflow-y-auto select-none">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header Banner */}
        <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-violet-100 text-violet-700">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Serviços de Bancos & Utilitários Portáteis
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Detecção automática de servidores locais e gerenciamento de ferramentas CLI do DadData
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-violet-600' : ''}`} />
            <span>Re-escanear Máquina</span>
          </button>
        </div>

        {/* Status notification banner */}
        {statusMessage && (
          <div
            className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-zinc-100 text-zinc-800 border-zinc-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            ) : (
              <HelpCircle className="w-4 h-4 text-zinc-600 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Section 1: Detected Database Services */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-zinc-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
              Instâncias de Bancos Detectadas no Sistema Operacional
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map(svc => {
              const isRunning = svc.status === 'running';
              const isStopped = svc.status === 'stopped';
              const isNotInstalled = svc.status === 'not_installed';

              return (
                <div
                  key={svc.id}
                  className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-zinc-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center p-2 border border-zinc-200/60">
                        <DatabaseIcon type={svc.id as any} className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-zinc-900">{svc.label}</h4>
                        <p className="text-xs text-zinc-500">
                          {svc.serviceName ? `Serviço Windows: ${svc.serviceName}` : 'Processo local'}
                        </p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 ${
                        isRunning
                          ? 'bg-emerald-100 text-emerald-800'
                          : isStopped
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isRunning ? 'bg-emerald-500 animate-pulse' : isStopped ? 'bg-amber-500' : 'bg-zinc-400'
                        }`}
                      />
                      {isRunning ? 'Em Execução' : isStopped ? 'Parado' : 'Não Detectado'}
                    </span>
                  </div>

                  {/* Ports and tools found */}
                  <div className="space-y-2 pt-2 border-t border-zinc-100 text-xs">
                    <div className="flex justify-between text-zinc-600">
                      <span>Porta Padrão:</span>
                      <span className="font-mono font-semibold text-zinc-900">{svc.port || 'N/A'}</span>
                    </div>

                    {svc.version && (
                      <div className="flex justify-between text-zinc-600">
                        <span>Versão Detectada:</span>
                        <span className="font-mono text-zinc-900">{svc.version}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-zinc-500">Utilitários CLI Encontrados:</span>
                      <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                        {Object.entries(svc.tools).length > 0 ? (
                          Object.entries(svc.tools).map(([tool, path]) => (
                            <span
                              key={tool}
                              title={path}
                              className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200"
                            >
                              {tool}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">Nenhum executável CLI encontrado no PATH</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Portable Tools Management */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-zinc-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
              Utilitários CLI Portáteis do DadData
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tools.map(tool => {
              const isDownloading = downloadingToolId === tool.id;

              return (
                <div
                  key={tool.id}
                  className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-zinc-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-amber-500" />
                        <h4 className="font-bold text-sm text-zinc-900">{tool.name}</h4>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono">
                        {tool.isInstalled ? `Instalado • ${tool.version || 'v1.0'}` : 'Não instalado localmente'}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        tool.isInstalled
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {tool.isInstalled ? 'Disponível' : 'Pendente'}
                    </span>
                  </div>

                  {tool.path && (
                    <div className="pt-2 border-t border-zinc-100 text-[11px] text-zinc-500 font-mono truncate" title={tool.path}>
                      Caminho: {tool.path}
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleDownloadTool(tool.id)}
                      disabled={isDownloading}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isDownloading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Baixando...</span>
                        </>
                      ) : tool.isInstalled ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Reinstalar</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 text-amber-400" />
                          <span>Baixar Ferramenta</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServicesTab;
