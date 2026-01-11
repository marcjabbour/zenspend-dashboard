
import React, { useMemo } from 'react';
import { X, PieChart, TrendingDown, Wallet, ArrowUpRight } from 'lucide-react';
import { Transaction, Category, UserSettings } from '../types';

interface WeeklySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  start: Date;
  end: Date;
  transactions: Transaction[];
  categories: Category[];
  settings: UserSettings;
  currentDate: Date;
}

const WeeklySummaryModal: React.FC<WeeklySummaryModalProps> = ({ 
  isOpen, onClose, start, end, transactions, categories, settings, currentDate 
}) => {
  const startStr = start.toLocaleDateString('en-CA');
  const endStr = end.toLocaleDateString('en-CA');

  const weeklyTxs = useMemo(() => {
    // CRITICAL: Exclude fixed costs from weekly summary
    return transactions.filter(tx => tx.date >= startStr && tx.date <= endStr && !tx.isFixed && tx.categoryId !== 'fixed');
  }, [transactions, startStr, endStr]);

  const stats = useMemo(() => {
    const expenses = weeklyTxs.filter(t => t.type === 'expense');
    const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);
    const byCategory = categories.map(cat => {
      const spent = expenses.filter(t => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0);
      const budget = cat.period === 'weekly' ? cat.weeklyBudget : cat.weeklyBudget / 4.33;
      return { ...cat, spent, budget };
    });
    return { totalSpent, byCategory };
  }, [weeklyTxs, categories]);

  // Calculate prorated weekly allowance based on days in this week that fall within the month
  const proratedAllowance = useMemo(() => {
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const dailyAllowance = settings.monthlyIncome / daysInMonth;

    // Count days in this week that are within the current month
    let daysInWeek = 0;
    const current = new Date(start);
    while (current <= end) {
      if (current >= monthStart && current <= monthEnd) {
        daysInWeek++;
      }
      current.setDate(current.getDate() + 1);
    }

    return dailyAllowance * daysInWeek;
  }, [start, end, settings.monthlyIncome]);

  const remainingAllowance = proratedAllowance - stats.totalSpent;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f0f0f] w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Weekly Variable Insights</h2>
            <p className="text-xs text-slate-500">
              {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-2xl bg-indigo-600/10 border border-indigo-500/20">
              <div className="flex items-center gap-2 text-indigo-400 mb-2">
                <Wallet size={16} />
                <span className="text-[10px] uppercase font-bold tracking-widest">Variable Spent</span>
              </div>
              <p className="text-3xl font-bold">{settings.currency}{Math.round(stats.totalSpent).toLocaleString()}</p>
            </div>
            <div className={`p-6 rounded-2xl border ${remainingAllowance < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
              <div className={`flex items-center gap-2 mb-2 ${remainingAllowance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                <ArrowUpRight size={16} />
                <span className="text-[10px] uppercase font-bold tracking-widest">Leftover Allowance</span>
              </div>
              <p className="text-3xl font-bold font-mono">
                {remainingAllowance < 0 ? '-' : ''}{settings.currency}{Math.abs(Math.round(remainingAllowance)).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500 flex items-center gap-2">
              <PieChart size={14} /> Variable Category Breakdown
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {stats.byCategory.map(cat => {
                const percentage = Math.min((cat.spent / cat.budget) * 100, 100);
                const isOver = cat.spent > cat.budget;
                return (
                  <div key={cat.id} className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: cat.color}} />
                        {cat.name}
                      </span>
                      <span className={`text-xs font-mono ${isOver ? 'text-red-400' : 'text-slate-400'}`}>
                        {settings.currency}{Math.round(cat.spent)} / {settings.currency}{Math.round(cat.budget)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-700 ${isOver ? 'bg-red-500' : ''}`}
                        style={{ width: `${percentage}%`, backgroundColor: isOver ? undefined : cat.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 bg-[#0a0a0a] border-t border-white/5">
          <button onClick={onClose} className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-sm font-bold transition-all">Close Summary</button>
        </div>
      </div>
    </div>
  );
};

export default WeeklySummaryModal;
