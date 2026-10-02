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
    <header className="h-16 px-6 flex items-center justify-between z-10 border-b border-[#E2E8E5] bg-white/80 backdrop-blur-md">
      {/* Brand & Logo - AbacatePay Style */}
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-[#0C1818] border border-[#1E3B3A] flex items-center justify-center p-2 relative group cursor-pointer transition-transform hover:scale-105 shadow-sm">
          {/* Avocado-inspired geometric icon with neon seed */}
          <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
            <path
              d="M16 4C10.5 4 6 9.5 6 16C6 22.5 10.5 28 16 28C21.5 28 26 22.5 26 16C26 9.5 21.5 4 16 4Z"
              stroke="#00F566"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <circle cx="16" cy="18" r="5" fill="#00F566" />
            <path d="M16 4V9" stroke="#00F566" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-[#0C1818]">DadData</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#00F566]/15 text-[#047857] border border-[#00F566]/40">
              Universal DB
            </span>
          </div>
          <p className="text-[11px] text-[#64837E] font-medium">Bancos Modernos &amp; Legados (DBF, Paradox, Access, HFSQL, Firebird)</p>
        </div>
      </div>

      {/* Active Database Badge Pill */}
      {activeConnection && (
        <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#F2F6F4] border border-[#D3DDD8] shadow-sm">
          <DatabaseIcon type={activeConnection.type} className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-semibold text-[#0C1818]">{activeConnection.name}</span>
          <span className="text-[10px] uppercase px-2 py-0.5 rounded-full font-mono font-bold bg-[#0C1818] text-[#00F566]">
            {activeConnection.type}
          </span>
          <button
            onClick={onRefreshSchema}
            disabled={isLoading}
            title="Recarregar Esquema e Tabelas"
            className="p-1 hover:bg-[#E2E8E5] rounded-full transition-colors ml-1 text-[#64837E] hover:text-[#0C1818]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#047857]' : ''}`} />
          </button>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex items-center gap-3">
        {/* AbacatePay Signature Neon CTA */}
        <button
          onClick={onOpenNewConnection}
          className="h-9 px-4 rounded-full bg-[#00F566] hover:bg-[#00DF61] text-[#0C1818] text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nova Conexão</span>
        </button>
      </div>
    </header>
  );
};
export default Header;
