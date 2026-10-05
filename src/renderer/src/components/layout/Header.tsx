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
    <header className="h-14 px-6 flex items-center justify-between z-10 border-b border-zinc-200/80 bg-white">
      {/* Brand & Logo - AbacatePay Minimalist Style */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center p-1.5 transition-transform hover:scale-105 shadow-sm">
          {/* Avocado with warm golden seed */}
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
            <path
              d="M12 2.5C8 2.5 5 7 5 12.5C5 18 8 21.5 12 21.5C16 21.5 19 18 19 12.5C19 7 16 2.5 12 2.5Z"
              stroke="#18181B"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="14" r="3.2" fill="#FACC15" stroke="#18181B" strokeWidth="1.4" />
            <path d="M12 2.5V5" stroke="#18181B" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-zinc-900 font-sans">DadData</span>
        </div>
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
