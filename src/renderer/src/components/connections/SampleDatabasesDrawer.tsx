import React, { useState, useEffect } from 'react';
import { X, Sparkles, ArrowRight, Layers, Database } from 'lucide-react';
import { ConnectionConfig, DatabaseType } from '@shared/types/database';
import { DatabaseIcon } from '../icons/DatabaseIcon';
import { safeApi } from '../../services/api-client';

interface SampleDatabaseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectSample: (config: ConnectionConfig) => Promise<void>;
}

export const SampleDatabasesDrawer: React.FC<SampleDatabaseDrawerProps> = ({
  isOpen,
  onClose,
  onConnectSample
}) => {
  const [samples, setSamples] = useState<{ name: string; type: DatabaseType; filePath: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectingType, setConnectingType] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSamples();
    }
  }, [isOpen]);

  const loadSamples = async () => {
    setIsLoading(true);
    try {
      const list = await safeApi.getSampleDatabases();
      setSamples(list);
    } catch (err: any) {
      console.error('Failed to load samples:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleConnect = async (sample: { name: string; type: DatabaseType; filePath: string }) => {
    setConnectingType(sample.type);
    try {
      await onConnectSample({
        id: `sample_${sample.type}`,
        name: sample.name,
        type: sample.type,
        filePath: sample.filePath
      });
      onClose();
    } catch (err: any) {
      alert(`Erro ao abrir amostra: ${err.message}`);
    } finally {
      setConnectingType(null);
    }
  };

  const sampleDescriptions: Record<string, { badge: string; desc: string }> = {
    dbf: { badge: 'Legado dBase / FoxPro', desc: 'Tabela de clientes com campos numéricos, alfanuméricos, datas e valores decimais.' },
    paradox: { badge: 'Legado Paradox .DB', desc: 'Tabela Borland Paradox com auto-incremento, limites de crédito e razão social.' },
    access: { badge: 'Legado Access .MDB', desc: 'Banco de dados Microsoft Jet com múltiplas tabelas (Customers e Orders).' },
    hfsql: { badge: 'Legado HFSQL WinDev', desc: 'Tabela de produtos e estoque do motor PC SOFT HyperFileSQL Classic.' },
    nexusdb: { badge: 'Legado NexusDB Delphi', desc: 'Tabela de contas financeiras com saldos em formato NexusDB.' },
    sqlite: { badge: 'Moderno SQLite 3', desc: 'Banco de dados SQL portátil com dados de clientes e pedidos.' }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 w-[480px] max-w-full bg-white shadow-2xl flex flex-col border-l border-slate-200/80 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-purple-50 text-purple-700 border border-purple-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Bancos de Amostra</h3>
              <p className="text-xs text-slate-500">Conecte-se com 1 clique para testar consultas e exportação</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Samples List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs">Carregando bases de teste...</div>
          ) : (
            samples.map(sample => {
              const meta = sampleDescriptions[sample.type] || {
                badge: sample.type,
                desc: 'Banco de dados de teste'
              };
              const isConnecting = connectingType === sample.type;

              return (
                <div
                  key={sample.type}
                  className="p-4 rounded-3xl border border-slate-200/80 hover:border-purple-300 hover:bg-purple-50/20 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2 rounded-2xl bg-slate-50 group-hover:bg-white border border-slate-100 shadow-sm">
                      <DatabaseIcon type={sample.type} className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">{sample.name}</h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {meta.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{meta.desc}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleConnect(sample)}
                    disabled={isConnecting}
                    className="px-4 py-2 rounded-full bg-[#121217] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50 ml-2"
                  >
                    <span>{isConnecting ? 'Abrindo...' : 'Abrir'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};
