
import React, { useMemo } from 'react';
import { UserSettings, Transaction } from '../types';
import { Calculator, Landmark, AlertTriangle } from 'lucide-react';

interface SanityCheckProps {
  transactions: Transaction[];
  settings: UserSettings;
  updateSettings: (s: Partial<UserSettings>) => void;
}

const SanityCheck: React.FC<SanityCheckProps> = ({ transactions, settings, updateSettings }) => {
  const calculations = useMemo(() => {
    const baseDate = new Date(settings.balanceAsOf);
    const futureTransactions = transactions.filter(t => new Date(t.date) >= baseDate);
    
    let expectedChecking = settings.checkingBalance;
    let expectedCC = settings.creditCardBalance;

    futureTransactions.forEach(tx => {
      if (tx.type === 'expense') {
        // Assume default expense comes from CC, income from Checking
        expectedCC += tx.amount;
      } else if (tx.type === 'income') {
        expectedChecking += tx.amount;
      } else if (tx.type === 'cc_payment') {
        expectedChecking -= tx.amount;
        expectedCC -= tx.amount;
      }
    });

    return { expectedChecking, expectedCC };
  }, [transactions, settings]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="p-8 rounded-3xl bg-[#0f0f0f] border border-white/5 space-y-6">
          <div className="flex items-center gap-3">
            <Landmark className="text-indigo-400" size={24} />
            <h3 className="text-lg font-bold">Current Bank State</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">Starting Checking Balance</label>
              <input type="number" value={settings.checkingBalance} onChange={e => updateSettings({checkingBalance: parseFloat(e.target.value)})}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-xl font-mono"/>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">Starting CC Balance</label>
              <input type="number" value={settings.creditCardBalance} onChange={e => updateSettings({creditCardBalance: parseFloat(e.target.value)})}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-xl font-mono"/>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">As of Date</label>
              <input type="datetime-local" value={settings.balanceAsOf.slice(0, 16)} onChange={e => updateSettings({balanceAsOf: new Date(e.target.value).toISOString()})}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm"/>
            </div>
          </div>
        </section>

        <section className="p-8 rounded-3xl bg-indigo-600/5 border border-indigo-500/10 flex flex-col justify-center space-y-8">
          <div className="flex items-center gap-3">
            <Calculator className="text-indigo-400" size={24} />
            <h3 className="text-lg font-bold">Projection Logic</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
              <p className="text-[10px] uppercase text-slate-500 mb-1">Checking Should Be</p>
              <p className="text-2xl font-bold text-white font-mono">${calculations.expectedChecking.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
              <p className="text-[10px] uppercase text-slate-500 mb-1">CC Debt Should Be</p>
              <p className="text-2xl font-bold text-white font-mono">${calculations.expectedCC.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-200 text-xs leading-relaxed">
            <AlertTriangle className="shrink-0" size={18} />
            <p>If your actual bank balance differs from these numbers, check if you've missed logging any small transactions or recurring subscriptions.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SanityCheck;
