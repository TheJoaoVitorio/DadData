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
        className="fixed inset-0 z-40 bg-zinc-900/30 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 w-[480px] max-w-full bg-white shadow-2xl flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-zinc-900">Novo Registro</h3>
            <p className="text-xs text-zinc-500">
              Inserindo na tabela: <span className="font-bold text-amber-700">{tableName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-800 transition-colors"
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
                <label className="block text-xs font-bold text-zinc-800 mb-1 flex items-center justify-between">
                  <span>{col}</span>
                  {isPk && (
                    <span className="text-[10px] text-amber-900 font-mono font-bold bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                      Chave Primária
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder={isPk ? '(Auto incremento ou digite ID)' : `Informe ${col}`}
                  value={formData[col] || ''}
                  onChange={e => handleFieldChange(col, e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 focus:bg-white border border-zinc-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 rounded-xl text-xs text-zinc-900 font-mono focus:outline-none transition-all"
                />
              </div>
            );
          })}
        </form>

        {/* Footer Actions */}
        <div className="p-5 border-t border-zinc-200 flex items-center justify-end gap-2.5 bg-zinc-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-50"
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
