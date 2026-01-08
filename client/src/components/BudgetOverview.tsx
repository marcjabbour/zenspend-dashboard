
import React, { useState } from 'react';
import { Category, Transaction, UserSettings } from '../types';
import { Calendar, BarChart3 } from 'lucide-react';
import CategoryTransactionsModal from './CategoryTransactionsModal';

interface BudgetOverviewProps {
  categories: Category[];
  transactions: Transaction[];
  settings: UserSettings;
  currentDate: Date;
  onEditTransaction: (tx: Transaction) => void;
}

interface SelectedCategory {
  category: Category;
  transactions: Transaction[];
  periodLabel: string;
}

const BudgetOverview: React.FC<BudgetOverviewProps> = ({
  categories,
  transactions,
  settings,
  currentDate,
  onEditTransaction,
}) => {
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);

  // Week range: Sunday to Saturday (inclusive) - returns YYYY-MM-DD strings for reliable comparison
  const getWeekRange = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 6 = Saturday
    const startDate = new Date(d);
    startDate.setDate(d.getDate() - day); // Go back to Sunday
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // Saturday
    return {
      start: startDate,
      end: endDate,
      startStr: startDate.toLocaleDateString('en-CA'),
      endStr: endDate.toLocaleDateString('en-CA'),
    };
  };

  const getMonthRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
      start,
      end,
      startStr: start.toLocaleDateString('en-CA'),
      endStr: end.toLocaleDateString('en-CA'),
    };
  };

  const now = new Date();
  const currentWeek = getWeekRange(now);
  const currentMonth = getMonthRange(now);

  // Calculate month progress (how far through the month we are)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthProgress = (dayOfMonth / daysInMonth) * 100;

  // Calculate total monthly budget and spent (excluding subscriptions which are monthly)
  const weeklyCategories = categories.filter(c => c.period === 'weekly');
  const monthlyCategories = categories.filter(c => c.period === 'monthly');

  // For monthly view, we need to calculate weekly budgets * ~4.33 weeks
  const weeksInMonth = daysInMonth / 7;

  const totalMonthlyBudget = weeklyCategories.reduce((sum, cat) => sum + cat.weeklyBudget * weeksInMonth, 0);

  const totalMonthlySpent = weeklyCategories.reduce((sum, cat) => {
    const spent = transactions
      .filter(tx => tx.categoryId === cat.id && tx.type === 'expense')
      .filter(tx => tx.date >= currentMonth.startStr && tx.date <= currentMonth.endStr)
      .reduce((s, tx) => s + tx.amount, 0);
    return sum + spent;
  }, 0);

  const budgetProgress = totalMonthlyBudget > 0 ? (totalMonthlySpent / totalMonthlyBudget) * 100 : 0;

  const handleCategoryClick = (cat: Category, range: { start: Date; end: Date; startStr: string; endStr: string }, isWeekly: boolean) => {
    const catTransactions = transactions
      .filter(tx => tx.categoryId === cat.id && tx.type === 'expense')
      .filter(tx => tx.date >= range.startStr && tx.date <= range.endStr);

    const periodLabel = isWeekly
      ? `${range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    setSelectedCategory({
      category: cat,
      transactions: catTransactions,
      periodLabel,
    });
  };

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500">Spending Progress</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('weekly')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
              viewMode === 'weekly'
                ? 'bg-indigo-600/20 text-indigo-400'
                : 'bg-white/5 text-slate-500 hover:text-slate-400'
            }`}
          >
            <BarChart3 size={12} />
            Weekly
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
              viewMode === 'monthly'
                ? 'bg-indigo-600/20 text-indigo-400'
                : 'bg-white/5 text-slate-500 hover:text-slate-400'
            }`}
          >
            <Calendar size={12} />
            Monthly
          </button>
        </div>
      </div>

      {viewMode === 'monthly' ? (
        <div className="space-y-6">
          {/* Month Progress Bar */}
          <div>
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="font-medium text-slate-400">Month Progress</span>
              <span className="font-mono text-slate-300">
                Day {dayOfMonth} of {daysInMonth}
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-500 transition-all duration-500"
                style={{ width: `${monthProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-slate-500">Time elapsed</span>
              <span className="text-[10px] font-bold text-slate-400">{Math.round(monthProgress)}%</span>
            </div>
          </div>

          {/* Budget Progress Bar (weekly categories only) */}
          <div>
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="font-medium text-slate-400">Variable Spending</span>
              <span className={`font-mono ${budgetProgress > 100 ? 'text-red-400' : 'text-slate-300'}`}>
                {settings.currency}{Math.round(totalMonthlySpent).toLocaleString()} / {settings.currency}{Math.round(totalMonthlyBudget).toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden relative">
              {/* Reference line for where we should be */}
              <div
                className="absolute h-full w-0.5 bg-slate-500/50 z-10"
                style={{ left: `${monthProgress}%` }}
              />
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetProgress > monthProgress + 10
                    ? 'bg-amber-500'
                    : budgetProgress > 100
                    ? 'bg-red-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(budgetProgress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-slate-500">
                {budgetProgress > monthProgress + 10
                  ? 'Spending ahead of pace'
                  : budgetProgress > 100
                  ? 'Over budget'
                  : 'On track'}
              </span>
              <span className={`text-[10px] font-bold ${
                budgetProgress > 100 ? 'text-red-500' : budgetProgress > monthProgress + 10 ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                {Math.round(budgetProgress)}%
              </span>
            </div>
          </div>

          {/* Subscriptions (monthly categories) still show individually */}
          {monthlyCategories.length > 0 && (
            <div className="pt-4 border-t border-white/5">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-600 mb-3">Subscriptions</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {monthlyCategories.map(cat => {
                  const catTxs = transactions
                    .filter(tx => tx.categoryId === cat.id && tx.type === 'expense')
                    .filter(tx => tx.date >= currentMonth.startStr && tx.date <= currentMonth.endStr);
                  const spent = catTxs.reduce((sum, tx) => sum + tx.amount, 0);

                  const budget = cat.weeklyBudget;
                  const remaining = budget - spent;
                  const percentage = Math.min((spent / budget) * 100, 100);
                  const isOver = spent > budget;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => handleCategoryClick(cat, currentMonth, false)}
                      className="cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 py-1 rounded-lg transition-colors"
                    >
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="font-medium text-slate-400 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                        <span className={`font-mono ${isOver ? 'text-red-400' : 'text-slate-300'}`}>
                          {settings.currency}{spent.toLocaleString()} / {settings.currency}{budget.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: isOver ? '#f87171' : cat.color,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] text-slate-500">{isOver ? 'Over budget' : 'Remaining'}</span>
                        <span className={`text-[10px] font-bold ${isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                          {isOver ? '-' : ''}{settings.currency}{Math.abs(Math.round(remaining)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {categories.map(cat => {
            const isWeekly = cat.period === 'weekly';
            const range = isWeekly ? currentWeek : currentMonth;

            const catTxs = transactions
              .filter(tx => tx.categoryId === cat.id && tx.type === 'expense')
              .filter(tx => tx.date >= range.startStr && tx.date <= range.endStr);
            const spent = catTxs.reduce((sum, tx) => sum + tx.amount, 0);

            const budget = cat.weeklyBudget;
            const remaining = budget - spent;
            const percentage = Math.min((spent / budget) * 100, 100);
            const isOver = spent > budget;

            return (
              <div
                key={cat.id}
                onClick={() => handleCategoryClick(cat, range, isWeekly)}
                className="cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 py-1 rounded-lg transition-colors"
              >
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="font-medium text-slate-400 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
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
                      backgroundColor: isOver ? '#f87171' : cat.color,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-slate-500">{isOver ? 'Over budget' : 'Remaining'}</span>
                  <span className={`text-[10px] font-bold ${isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                    {isOver ? '-' : ''}{settings.currency}{Math.abs(Math.round(remaining)).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedCategory && (
        <CategoryTransactionsModal
          isOpen={!!selectedCategory}
          onClose={() => setSelectedCategory(null)}
          category={selectedCategory.category}
          transactions={selectedCategory.transactions}
          settings={settings}
          periodLabel={selectedCategory.periodLabel}
          onEditTransaction={onEditTransaction}
        />
      )}
    </div>
  );
};

export default BudgetOverview;
