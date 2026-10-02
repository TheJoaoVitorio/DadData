import React, { useState, useEffect } from 'react';
import { X, Sparkles, Database, Check, ArrowRight, Layers } from 'lucide-react';
import { ConnectionConfig, DatabaseType } from '@shared/types/database';

interface SampleDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectSample: (config: ConnectionConfig) => Promise<void>;
}

export const SampleDatabasesModal: React.FC<SampleDatabaseModalProps> = ({
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
      const list = await window.api.getSampleDatabases();
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
      alert(`Erro ao carregar amostra: ${err.message}`);
    } finally {
      setConnectingType(null);
    }
  };

  const sampleDescriptions: Record<string, { badge: string; desc: string; icon: string }> = {
    dbf: { badge: 'Legado dBase / FoxPro', desc: 'Tabela de clientes com campos numéricos, alfanuméricos, datas e valores decimais.', icon: '📁' },
    paradox: { badge: 'Legado Paradox .DB', desc: 'Tabela Borland Paradox com auto-incremento, limites de crédito e razão social.', icon: '💾' },
    access: { badge: 'Legado Access .MDB', desc: 'Banco de dados Microsoft Jet com múltiplas tabelas (Customers e Orders).', icon: '📑' },
    hfsql: { badge: 'Legado HFSQL WinDev', desc: 'Tabela de produtos e estoque do motor PC SOFT HyperFileSQL Classic.', icon: '📦' },
    nexusdb: { badge: 'Legado NexusDB Delphi', desc: 'Tabela de contas financeiras com saldos em formato NexusDB.', icon: '🏛️' },
    sqlite: { badge: 'Moderno SQLite 3', desc: 'Banco de dados SQL portátil com dados de clientes e pedidos.', icon: '⚡' }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100/60 text-purple-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Bancos de Dados de Amostra</h3>
              <p className="text-xs text-slate-500">Conecte-se com 1 clique para testar consultas, CRUD e exportação.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Samples List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2.5 pr-1">
          {isLoading ? (
            <div className="text-center py-8 text-slate-400 text-xs">Preparando arquivos de amostra...</div>
          ) : (
            samples.map(sample => {
              const meta = sampleDescriptions[sample.type] || {
                badge: sample.type,
                desc: 'Banco de dados de amostra',
                icon: '🗄️'
              };
              const isConnecting = connectingType === sample.type;

              return (
                <div
                  key={sample.type}
                  className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-purple-300 hover:bg-purple-50/20 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">{sample.name}</h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {meta.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{meta.desc}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleConnect(sample)}
                    disabled={isConnecting}
                    className="px-4 py-1.5 rounded-full bg-[#121217] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <span>{isConnecting ? 'Abrindo...' : 'Conectar'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
