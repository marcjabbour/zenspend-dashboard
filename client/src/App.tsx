import React, { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Plus,
  DollarSign,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Mic,
  Wallet,
  ArrowRightLeft,
  Shield,
  Loader2,
} from 'lucide-react';
import { Transaction, RecurrenceAction } from './types';
import { useCategories } from './hooks/useCategories';
import { useTransactions, useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from './hooks/useTransactions';
import { useSettings, useUpdateSettings } from './hooks/useSettings';
import Calendar from './components/Calendar';
import Sidebar from './components/Sidebar';
import BudgetOverview from './components/BudgetOverview';
import TransactionModal from './components/TransactionModal';
import SettingsModal from './components/SettingsModal';
import SanityCheck from './components/SanityCheck';
import WeeklySummaryModal from './components/WeeklySummaryModal';
import LiveAgentOverlay from './components/LiveAgentOverlay';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

const AppContent: React.FC = () => {
  // UI State (not persisted to backend)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sanity'>('dashboard');
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isLiveAgentOpen, setIsLiveAgentOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string | undefined>(undefined);
  const [weeklySummaryRange, setWeeklySummaryRange] = useState<{ start: Date; end: Date } | null>(null);

  // Data from API via React Query
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions();
  const { data: settings, isLoading: settingsLoading } = useSettings();

  // Mutations
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const updateSettings = useUpdateSettings();

  // Default settings while loading
  const currentSettings = settings || {
    monthlyIncome: 8000,
    currency: '$',
    showFixedCosts: true,
    checkingBalance: 0,
    creditCardBalance: 0,
    balanceAsOf: new Date().toISOString(),
  };

  // Handle transaction submit
  const handleTransactionSubmit = async (txData: Omit<Transaction, 'id'>, recurrence?: RecurrenceAction) => {
    try {
      if (editingTx) {
        await updateTransaction.mutateAsync({
          id: editingTx.id,
          data: txData,
          recurrence,
          groupId: editingTx.groupId,
          fromDate: editingTx.date,
        });
      } else {
        await createTransaction.mutateAsync({
          data: txData,
          isRecurring: txData.isFixed,
          months: 12,
        });
      }
      setIsTxModalOpen(false);
      setEditingTx(null);
    } catch (error) {
      console.error('Failed to save transaction:', error);
    }
  };

  // Handle transaction delete
  const handleTransactionDelete = async (id: string, recurrence?: RecurrenceAction) => {
    try {
      const tx = transactions.find((t) => t.id === id);
      await deleteTransaction.mutateAsync({
        id,
        recurrence,
        groupId: tx?.groupId,
        fromDate: tx?.date,
      });
      setIsTxModalOpen(false);
      setEditingTx(null);
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
  };

  // Handle settings toggle
  const handleToggleFixedCosts = () => {
    updateSettings.mutate({ showFixedCosts: !currentSettings.showFixedCosts });
  };

  // Financial Stats calculation
  const financialStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1).toLocaleDateString('en-CA');
    const endOfMonth = new Date(year, month + 1, 0).toLocaleDateString('en-CA');

    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(new Date(d).setDate(diff)).toLocaleDateString('en-CA');
    const endOfWeek = new Date(new Date(d).setDate(diff + 6)).toLocaleDateString('en-CA');

    const monthTxs = transactions.filter((tx) => tx.date >= startOfMonth && tx.date <= endOfMonth);

    const monthFixedCosts = monthTxs
      .filter((tx) => (tx.isFixed || tx.categoryId === 'fixed') && tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const effectiveIncome = currentSettings.showFixedCosts
      ? currentSettings.monthlyIncome
      : currentSettings.monthlyIncome - monthFixedCosts;

    const filteredMonthTxs = currentSettings.showFixedCosts
      ? monthTxs
      : monthTxs.filter((tx) => !tx.isFixed && tx.categoryId !== 'fixed');

    const weekTxs = transactions.filter(
      (tx) =>
        tx.date >= startOfWeek &&
        tx.date <= endOfWeek &&
        !tx.isFixed &&
        tx.categoryId !== 'fixed' &&
        tx.type === 'expense'
    );

    const monthSpent = filteredMonthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const weekSpent = weekTxs.reduce((s, t) => s + t.amount, 0);
    const remaining = effectiveIncome - monthSpent;

    return {
      monthSpent,
      weekSpent,
      remaining,
      effectiveIncome,
      monthFixedCosts,
    };
  }, [transactions, currentDate, currentSettings.monthlyIncome, currentSettings.showFixedCosts]);

  const CurrencyValue = ({ value, prefix = '' }: { value: number; prefix?: string }) => (
    <span className={`${isPrivacyMode ? 'blur-md hover:blur-none transition-all duration-300' : ''}`}>
      {currentSettings.currency}
      {prefix}
      {Math.round(value).toLocaleString()}
    </span>
  );

  // Loading state
  if (categoriesLoading || transactionsLoading || settingsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505] text-slate-200">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#050505] text-slate-200 font-sans">
      <Sidebar
        settings={currentSettings}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        categories={categories}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 px-8 flex items-center justify-between border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">
              {activeTab === 'dashboard' ? 'Dashboard' : 'Sanity Check'}
            </h1>
            <div className="h-6 w-px bg-white/10 mx-2" />

            <button
              onClick={() => setIsPrivacyMode(!isPrivacyMode)}
              className={`p-2 rounded-lg transition-all ${
                isPrivacyMode ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:bg-white/5'
              }`}
              title="Privacy Mode"
            >
              {isPrivacyMode ? <Shield size={18} /> : <Eye size={18} />}
            </button>

            <button
              onClick={handleToggleFixedCosts}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentSettings.showFixedCosts ? 'bg-indigo-600/20 text-indigo-400' : 'bg-white/5 text-slate-500'
              }`}
              title={
                currentSettings.showFixedCosts
                  ? 'Hiding Fixed Costs from summary numbers'
                  : 'Showing all costs in summary numbers'
              }
            >
              {currentSettings.showFixedCosts ? <Eye size={14} /> : <EyeOff size={14} />}
              Fixed Costs {currentSettings.showFixedCosts ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsLiveAgentOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/5 text-indigo-400"
            >
              <Mic size={16} /> Live Agent
            </button>
            <button
              onClick={() => {
                setEditingTx(null);
                setSelectedDateStr(undefined);
                setIsTxModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <Plus size={18} /> New Entry
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth custom-scrollbar">
          {activeTab === 'dashboard' ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Planned Income',
                    val: financialStats.effectiveIncome,
                    color: 'text-emerald-400',
                    icon: Wallet,
                    sub: currentSettings.showFixedCosts ? 'Total' : 'Variable Only',
                  },
                  {
                    label: 'Monthly Spent',
                    val: financialStats.monthSpent,
                    color: 'text-slate-300',
                    icon: TrendingDown,
                    sub: currentSettings.showFixedCosts ? 'Incl. Fixed' : 'Variable',
                  },
                  {
                    label: 'Variable Week Spend',
                    val: financialStats.weekSpent,
                    color: 'text-indigo-400',
                    icon: ArrowRightLeft,
                    sub: 'Excl. Fixed',
                  },
                  {
                    label: 'Monthly Remaining',
                    val: financialStats.remaining,
                    color: financialStats.remaining < 0 ? 'text-red-400' : 'text-emerald-400',
                    icon: DollarSign,
                    sub: 'Remaining',
                  },
                ].map((stat, i) => (
                  <div key={i} className="p-4 bg-[#0f0f0f] border border-white/5 rounded-2xl">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <stat.icon size={12} className="text-slate-500" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                          {stat.label}
                        </span>
                      </div>
                      <span className="text-[8px] uppercase font-bold text-slate-600 px-1.5 py-0.5 bg-white/5 rounded">
                        {stat.sub}
                      </span>
                    </div>
                    <p className={`text-xl font-bold font-mono ${stat.color}`}>
                      <CurrencyValue value={stat.val} />
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-4 p-6 rounded-2xl bg-[#0f0f0f] border border-white/5 shadow-sm">
                  <BudgetOverview
                    categories={categories}
                    transactions={transactions}
                    settings={currentSettings}
                    currentDate={currentDate}
                  />
                </div>
              </div>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Financial Calendar</h2>
                  <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg">
                    <button
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                      className="p-2 hover:bg-white/10 rounded-md"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs px-2 font-bold min-w-[100px] text-center">
                      {currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                      className="p-2 hover:bg-white/10 rounded-md"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="bg-[#0a0a0a] rounded-3xl border border-white/5 p-1 overflow-hidden shadow-2xl">
                  <Calendar
                    currentDate={currentDate}
                    transactions={transactions}
                    categories={categories}
                    onDayClick={(dateStr) => {
                      setSelectedDateStr(dateStr);
                      setEditingTx(null);
                      setIsTxModalOpen(true);
                    }}
                    onEditTransaction={(tx) => {
                      setEditingTx(tx);
                      setIsTxModalOpen(true);
                    }}
                    onViewWeeklySummary={(start, end) => setWeeklySummaryRange({ start, end })}
                  />
                </div>
              </section>
            </>
          ) : (
            <SanityCheck
              transactions={transactions}
              settings={currentSettings}
              updateSettings={(s) => updateSettings.mutate(s)}
            />
          )}
        </div>
      </main>

      {isTxModalOpen && (
        <TransactionModal
          isOpen={isTxModalOpen}
          onClose={() => {
            setIsTxModalOpen(false);
            setEditingTx(null);
          }}
          onSubmit={handleTransactionSubmit}
          onDelete={handleTransactionDelete}
          categories={categories}
          initialData={editingTx}
          defaultDate={selectedDateStr}
          currency={currentSettings.currency}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={currentSettings}
          categories={categories}
        />
      )}

      {weeklySummaryRange && (
        <WeeklySummaryModal
          isOpen={!!weeklySummaryRange}
          onClose={() => setWeeklySummaryRange(null)}
          start={weeklySummaryRange.start}
          end={weeklySummaryRange.end}
          transactions={transactions}
          categories={categories}
          settings={currentSettings}
          currentDate={currentDate}
        />
      )}

      {isLiveAgentOpen && (
        <LiveAgentOverlay
          isOpen={isLiveAgentOpen}
          onClose={() => setIsLiveAgentOpen(false)}
          transactions={transactions}
          categories={categories}
          settings={currentSettings}
          onLogTransaction={handleTransactionSubmit}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

export default App;
