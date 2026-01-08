
import React, { useMemo } from 'react';
import { Settings, Wallet, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { UserSettings, Category } from '../types';

interface SidebarProps {
  settings: UserSettings;
  activeTab: 'dashboard' | 'sanity';
  setActiveTab: (tab: 'dashboard' | 'sanity') => void;
  onOpenSettings: () => void;
  categories: Category[];
}

const Sidebar: React.FC<SidebarProps> = ({ settings, activeTab, setActiveTab, onOpenSettings, categories }) => {
  const unallocated = useMemo(() => {
    const totalAllocated = categories.reduce((acc, cat) => {
      const multiplier = cat.period === 'weekly' ? 4.33 : 1;
      return acc + (cat.weeklyBudget * multiplier);
    }, 0);
    return settings.monthlyIncome - totalAllocated;
  }, [categories, settings.monthlyIncome]);

  return (
    <aside className="w-72 bg-[#0a0a0a] border-r border-white/5 flex flex-col hidden lg:flex">
      <div className="p-8 pb-4">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Wallet className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">ZenSpend</h2>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Premium Budgeting</p>
          </div>
        </div>

        <nav className="space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all text-sm font-medium ${
              activeTab === 'dashboard' ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('sanity')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all text-sm font-medium ${
              activeTab === 'sanity' ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <ShieldCheck size={20} />
            Sanity Check
          </button>
          <button 
            onClick={onOpenSettings}
            className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white rounded-xl transition-all text-sm font-medium"
          >
            <Settings size={20} />
            Settings
          </button>
        </nav>
      </div>

      <div className="px-8 mt-6 overflow-y-auto flex-1 custom-scrollbar">
        <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">Budgets</h3>
        <div className="space-y-5">
          {categories.map(cat => (
            <div key={cat.id} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {settings.currency}{cat.weeklyBudget}/{cat.period === 'weekly' ? 'wk' : 'mo'}
                </span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-slate-700 w-1/4" style={{ backgroundColor: cat.color }} />
              </div>
            </div>
          ))}
          <div className="pt-4 border-t border-white/5">
             <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Unallocated</span>
                <span className="text-[10px] font-mono text-emerald-400">{settings.currency}{Math.max(0, Math.round(unallocated))}</span>
             </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="bg-[#111] p-4 rounded-2xl border border-white/5">
          <p className="text-[11px] text-slate-500 font-bold uppercase mb-2">Weekly Allowance</p>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-2xl font-bold text-white">{settings.currency}{Math.round(settings.monthlyIncome / 4.33).toLocaleString()}</span>
            <span className="text-xs text-slate-500 mb-1">/ wk</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
