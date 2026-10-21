import React from 'react';
import { Database, Plus, RefreshCw } from 'lucide-react';
import { ConnectionConfig } from '@shared/types/database';
import { DatabaseIcon } from '../icons/DatabaseIcon';

interface HeaderProps {
  activeConnection: ConnectionConfig | null;
  onOpenNewConnection: () => void;
  onRefreshSchema: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeConnection,
  onOpenNewConnection,
  onRefreshSchema,
  isLoading
}) => {
  return (
    <header className="h-14 px-6 flex items-center justify-between z-10 bg-transparent flex-shrink-0">
      {/* Page title — sits above the rounded white sheet */}
      <div className="flex items-center gap-2.5">
        <Database className="w-4 h-4 text-zinc-500" />
        <span className="text-[15px] font-semibold tracking-tight text-zinc-800">Workspace</span>
      </div>

      {/* Active Database Badge Pill */}
      {activeConnection && (
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-zinc-100/80 border border-zinc-200 shadow-sm">
          <DatabaseIcon type={activeConnection.type} className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-semibold text-zinc-900">{activeConnection.name}</span>
          <span className="text-[10px] uppercase px-2 py-0.5 rounded-full font-mono font-bold bg-amber-100 text-amber-950 border border-amber-300/80">
            {activeConnection.type}
          </span>
          <button
            onClick={onRefreshSchema}
            disabled={isLoading}
            title="Recarregar Esquema e Tabelas"
            className="p-1 hover:bg-zinc-200 rounded-full transition-colors ml-0.5 text-zinc-500 hover:text-zinc-900"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex items-center gap-3">
        {/* AbacatePay Signature Yellow CTA Button */}
        <button
          onClick={onOpenNewConnection}
          className="h-8 px-4 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Nova Conexão</span>
        </button>
      </div>
    </header>
  );
};
export default Header;
