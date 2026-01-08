
import React, { useState, useEffect } from 'react';
import { X, Trash2, Repeat } from 'lucide-react';
import { Category, Transaction, TransactionType, RecurrenceAction } from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tx: Omit<Transaction, 'id'>, recurrence?: RecurrenceAction) => void;
  onDelete?: (id: string, recurrence?: RecurrenceAction) => void;
  categories: Category[];
  initialData?: Transaction | null;
  defaultDate?: string;
  currency: string;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ 
  isOpen, onClose, onSubmit, onDelete, categories, initialData, defaultDate, currency 
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toLocaleDateString('en-CA'));
  const [type, setType] = useState<TransactionType>('expense');
  const [isFixed, setIsFixed] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [showRecurrencePrompt, setShowRecurrencePrompt] = useState<{ type: 'edit' | 'delete' } | null>(null);

  useEffect(() => {
    if (initialData) {
      setAmount(initialData.amount.toString());
      setDescription(initialData.description);
      setCategoryId(initialData.categoryId);
      setDate(initialData.date);
      setType(initialData.type);
      setIsFixed(!!initialData.isFixed);
    } else {
      setAmount('');
      setDescription('');
      setCategoryId(categories[0]?.id || 'misc');
      setDate(defaultDate || new Date().toLocaleDateString('en-CA'));
      setType('expense');
      setIsFixed(false);
    }
  }, [initialData, defaultDate, categories]);

  const handleAction = (recurrence?: RecurrenceAction) => {
    if (showRecurrencePrompt?.type === 'delete') {
      onDelete?.(initialData!.id, recurrence);
      // Don't reset prompt - modal will close on successful delete
      return;
    }
    onSubmit({
      amount: parseFloat(amount),
      description,
      categoryId: categoryId,
      date,
      type,
      isFixed,
      groupId: initialData?.groupId || (isFixed ? crypto.randomUUID() : undefined)
    }, recurrence);
    setShowRecurrencePrompt(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    if (initialData?.isFixed) {
      setShowRecurrencePrompt({ type: 'edit' });
    } else {
      handleAction();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0f0f0f] w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 relative">
        {showRecurrencePrompt && (
          <div className="absolute inset-0 bg-[#0f0f0f] z-10 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
            <Repeat className="text-indigo-400 mb-4" size={40} />
            <h3 className="text-xl font-bold mb-2">Recurring Entry</h3>
            <p className="text-sm text-slate-400 mb-8">Apply this {showRecurrencePrompt.type} to:</p>
            <div className="flex flex-col gap-3 w-full">
              <button onClick={() => handleAction('one')} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium">Just this instance</button>
              <button onClick={() => handleAction('future')} className="w-full py-3 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-xl text-sm font-medium">This and future</button>
              <button onClick={() => handleAction('all')} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold">All instances</button>
              <button onClick={() => setShowRecurrencePrompt(null)} className="mt-4 text-xs text-slate-500 hover:text-white">Back</button>
            </div>
          </div>
        )}

        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{initialData ? 'Edit Entry' : 'Log Entry'}</h2>
          <div className="flex items-center gap-2">
            {initialData && (
              <button onClick={() => initialData.isFixed ? setShowRecurrencePrompt({type:'delete'}) : onDelete?.(initialData.id)} className="p-2 text-slate-500 hover:text-red-500 transition-colors">
                <Trash2 size={20} />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
            {(['expense', 'income', 'cc_payment'] as TransactionType[]).map(t => (
              <button key={t} type="button" onClick={() => setType(t)} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${type === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-600">{currency}</span>
              <input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-6 text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-slate-300"/>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Category</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-slate-300 appearance-none">
                <option value="fixed" className="text-slate-400 bg-[#0f0f0f]">Fixed Cost</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Description</label>
            <input required value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-300" placeholder="Lunch, Subscription..."/>
          </div>

          <label className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" checked={isFixed} onChange={e => {
              setIsFixed(e.target.checked);
              if(e.target.checked) setCategoryId('fixed');
            }} className="sr-only peer" />
            <div className="w-10 h-5 bg-white/5 rounded-full peer-checked:bg-indigo-600 relative transition-all">
              <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all" />
            </div>
            <span className="text-xs text-slate-400 group-hover:text-white transition-colors">Fixed Monthly Cost</span>
          </label>

          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold transition-all">
            {initialData ? 'Update Entry' : 'Confirm Entry'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
