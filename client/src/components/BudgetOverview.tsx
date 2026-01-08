
import React from 'react';
import { Category, Transaction, UserSettings } from '../types';

interface BudgetOverviewProps {
  categories: Category[];
  transactions: Transaction[];
  settings: UserSettings;
  currentDate: Date;
}

const BudgetOverview: React.FC<BudgetOverviewProps> = ({ categories, transactions, settings, currentDate }) => {
  const getWeekRange = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(new Date(d).setDate(diff));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const getMonthRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  };

  const currentWeek = getWeekRange(new Date());
  const currentMonth = getMonthRange(new Date());

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500">Variable Spending Progress</h3>
        <span className="text-[10px] bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded-full font-mono">
          Variable Only
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {categories.map(cat => {
          const isWeekly = cat.period === 'weekly';
          const range = isWeekly ? currentWeek : currentMonth;
          
          const spent = transactions
            .filter(tx => tx.categoryId === cat.id && tx.type === 'expense' && !tx.isFixed && tx.categoryId !== 'fixed')
            .filter(tx => {
              const d = new Date(tx.date);
              return d >= range.start && d <= range.end;
            })
            .reduce((sum, tx) => sum + tx.amount, 0);

          const budget = cat.weeklyBudget;
          const remaining = budget - spent;
          const percentage = Math.min((spent / budget) * 100, 100);
          const isOver = spent > budget;

          return (
            <div key={cat.id}>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="font-medium text-slate-400 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: cat.color}} />
                  {cat.name}
                  <span className="text-[9px] opacity-50 uppercase">{isWeekly ? 'wk' : 'mo'}</span>
                </span>
                <span className={`font-mono ${isOver ? 'text-red-400' : 'text-slate-300'}`}>
                  {settings.currency}{spent.toLocaleString()} / {settings.currency}{budget.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden relative">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${percentage}%`, 
                    backgroundColor: isOver ? '#f87171' : cat.color 
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-slate-500">
                  {isOver ? 'Over budget' : 'Remaining'}
                </span>
                <span className={`text-[10px] font-bold ${isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                  {isOver ? '-' : ''}{settings.currency}{Math.abs(Math.round(remaining)).toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BudgetOverview;
