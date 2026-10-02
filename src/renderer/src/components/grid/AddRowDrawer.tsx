import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { ColumnInfo } from '@shared/types/database';

interface AddRowDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  columns: string[];
  columnsMeta?: ColumnInfo[];
  onSave: (data: Record<string, any>) => Promise<void>;
}

export const AddRowDrawer: React.FC<AddRowDrawerProps> = ({
  isOpen,
  onClose,
  tableName,
  columns,
  columnsMeta = [],
  onSave
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
      setFormData({});
      onClose();
    } catch (err: any) {
      alert(`Erro ao salvar linha: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (colName: string, val: string) => {
    setFormData(prev => ({
      ...prev,
      [colName]: val
    }));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 w-[480px] max-w-full bg-white shadow-2xl flex flex-col border-l border-[#E2E8E5] animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8E5] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#0C1818]">Novo Registro</h3>
            <p className="text-xs text-[#64837E]">
              Inserindo na tabela: <span className="font-bold text-[#047857]">{tableName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#F2F6F4] text-[#64837E] hover:text-[#0C1818] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {columns.map(col => {
            const meta = columnsMeta.find(c => c.name === col);
            const isPk = meta?.isPrimaryKey || ['id', 'codigo', '_rowid'].includes(col.toLowerCase());

            return (
              <div key={col}>
                <label className="block text-xs font-bold text-[#142929] mb-1 flex items-center justify-between">
                  <span>{col}</span>
                  {isPk && (
                    <span className="text-[10px] text-[#047857] font-mono font-bold bg-[#00F566]/20 border border-[#00F566]/30 px-1.5 py-0.5 rounded">
                      Chave Primária
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder={isPk ? '(Auto incremento ou digite ID)' : `Informe ${col}`}
                  value={formData[col] || ''}
                  onChange={e => handleFieldChange(col, e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAF9] focus:bg-white border border-[#D3DDD8] focus:border-[#00F566] rounded-xl text-xs text-[#0C1818] font-mono focus:outline-none transition-all"
                />
              </div>
            );
          })}
        </form>

        {/* Footer Actions */}
        <div className="p-5 border-t border-[#E2E8E5] flex items-center justify-end gap-2.5 bg-[#F8FAF9]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-[#D3DDD8] text-xs font-semibold text-[#64837E] hover:bg-[#E2E8E5] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-full bg-[#00F566] hover:bg-[#00DF61] text-[#0C1818] text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isSubmitting ? 'Salvando...' : 'Salvar Registro'}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
export default AddRowDrawer;
