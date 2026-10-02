import React, { useState } from 'react';
import { X, Check, Plus, Layers } from 'lucide-react';
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
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 w-[480px] max-w-full bg-white shadow-2xl flex flex-col border-l border-slate-200/80 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Novo Registro</h3>
            <p className="text-xs text-slate-500">
              Inserindo na tabela: <span className="font-semibold text-purple-700">{tableName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{col}</span>
                  {isPk && (
                    <span className="text-[10px] text-purple-600 font-mono bg-purple-50 px-1.5 py-0.5 rounded">
                      Chave Primária
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder={isPk ? '(Auto ou digite ID)' : `Informe ${col}`}
                  value={formData[col] || ''}
                  onChange={e => handleFieldChange(col, e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs text-slate-800 focus:outline-none transition-all"
                />
              </div>
            );
          })}
        </form>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-full bg-[#121217] hover:bg-black text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Salvando...' : 'Salvar Registro'}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
