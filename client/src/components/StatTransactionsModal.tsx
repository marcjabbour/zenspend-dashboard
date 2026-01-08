
import React from 'react';
import { X } from 'lucide-react';
import { Transaction, Category, UserSettings } from '../types';

interface StatTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  periodLabel: string;
  transactions: Transaction[];
  categories: Category[];
  settings: UserSettings;
  onEditTransaction: (tx: Transaction) => void;
}

const StatTransactionsModal: React.FC<StatTransactionsModalProps> = ({
  isOpen,
  onClose,
  title,
  periodLabel,
  transactions,
  categories,
  settings,
  onEditTransaction,
}) => {
  if (!isOpen) return null;

  const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const sortedTxs = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f0f0f] w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-xs text-slate-500">{periodLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">Total</span>
            <span className="text-lg font-bold font-mono text-slate-200">
              {settings.currency}{totalSpent.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-slate-500">Transactions</span>
            <span className="text-sm font-mono text-slate-400">{transactions.length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {sortedTxs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p className="text-sm">No transactions this period</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {sortedTxs.map(tx => {
                const cat = categories.find(c => c.id === tx.categoryId);
                const date = new Date(tx.date + 'T00:00:00');
                const dateStr = date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={tx.id}
                    onClick={() => {
                      onClose();
                      onEditTransaction(tx);
                    }}
                    className="p-4 hover:bg-white/[0.02] cursor-pointer transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-2">
                        {cat && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                        )}
                        {tx.description}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{dateStr}</span>
                        {cat && <span className="text-slate-600">{cat.name}</span>}
                        {tx.isFixed && (
                          <span className="px-1.5 py-0.5 bg-slate-700/50 rounded text-[9px] uppercase">
                            Recurring
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-sm font-bold font-mono text-slate-300">
                      {settings.currency}{tx.amount.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 bg-[#0a0a0a] border-t border-white/5">
          <button
            onClick={onClose}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-sm font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatTransactionsModal;
