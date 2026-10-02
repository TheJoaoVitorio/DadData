import React, { useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { ColumnInfo } from '@shared/types/database';

interface AddRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  columns: string[];
  columnsMeta?: ColumnInfo[];
  onSave: (data: Record<string, any>) => Promise<void>;
}

export const AddRowModal: React.FC<AddRowModalProps> = ({
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
      alert(`Erro ao inserir linha: ${err.message}`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80 w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Novo Registro</h3>
            <p className="text-xs text-slate-500">Inserindo na tabela: <span className="font-semibold text-purple-700">{tableName}</span></p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
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
                  placeholder={isPk ? '(Auto ou digite ID)' : `Valor para ${col}`}
                  value={formData[col] || ''}
                  onChange={e => handleFieldChange(col, e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl text-xs text-slate-800 focus:outline-none transition-all"
                />
              </div>
            );
          })}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-[#121217] hover:bg-black text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Registro'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
