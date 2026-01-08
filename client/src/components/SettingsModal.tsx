import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserSettings, Category, BudgetPeriod } from '../types';
import { useUpdateSettings } from '../hooks/useSettings';
import { useCreateCategory, useUpdateCategory, useDeleteCategory } from '../hooks/useCategories';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  categories: Category[];
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, categories }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [localCategories, setLocalCategories] = useState([...categories]);
  const [pendingNewCategories, setPendingNewCategories] = useState<Category[]>([]);
  const [deletedCategoryIds, setDeletedCategoryIds] = useState<string[]>([]);

  const updateSettingsMutation = useUpdateSettings();
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const addCategory = () => {
    const newCat: Category = {
      id: crypto.randomUUID(),
      name: 'New Category',
      weeklyBudget: 0,
      period: 'weekly',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    };
    setLocalCategories([...localCategories, newCat]);
    setPendingNewCategories([...pendingNewCategories, newCat]);
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setLocalCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteCategory = (id: string) => {
    setLocalCategories((prev) => prev.filter((c) => c.id !== id));
    setPendingNewCategories((prev) => prev.filter((c) => c.id !== id));
    // Only add to deleted list if it was an existing category (not a pending new one)
    if (categories.some((c) => c.id === id)) {
      setDeletedCategoryIds([...deletedCategoryIds, id]);
    }
  };

  const handleSave = async () => {
    try {
      // Update settings
      await updateSettingsMutation.mutateAsync(localSettings);

      // Delete removed categories
      for (const id of deletedCategoryIds) {
        await deleteCategoryMutation.mutateAsync(id);
      }

      // Create new categories
      for (const cat of pendingNewCategories) {
        await createCategoryMutation.mutateAsync({
          name: cat.name,
          weeklyBudget: cat.weeklyBudget,
          period: cat.period,
          color: cat.color,
        });
      }

      // Update existing categories
      for (const cat of localCategories) {
        // Skip if it's a pending new category (already created above)
        if (pendingNewCategories.some((p) => p.id === cat.id)) continue;
        // Skip if it was deleted
        if (deletedCategoryIds.includes(cat.id)) continue;

        const original = categories.find((c) => c.id === cat.id);
        if (
          original &&
          (original.name !== cat.name ||
            original.weeklyBudget !== cat.weeklyBudget ||
            original.period !== cat.period ||
            original.color !== cat.color)
        ) {
          await updateCategoryMutation.mutateAsync({
            id: cat.id,
            data: {
              name: cat.name,
              weeklyBudget: cat.weeklyBudget,
              period: cat.period,
              color: cat.color,
            },
          });
        }
      }

      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // Logic to calculate monthly equivalent
  const budgetStats = useMemo(() => {
    const totalMonthlyBudget = localCategories.reduce((acc, cat) => {
      const multiplier = cat.period === 'weekly' ? 4.33 : 1;
      return acc + cat.weeklyBudget * multiplier;
    }, 0);

    const leftover = localSettings.monthlyIncome - totalMonthlyBudget;
    const percentageUsed = (totalMonthlyBudget / localSettings.monthlyIncome) * 100;

    return { totalMonthlyBudget, leftover, percentageUsed };
  }, [localCategories, localSettings.monthlyIncome]);

  const isSaving =
    updateSettingsMutation.isPending ||
    createCategoryMutation.isPending ||
    updateCategoryMutation.isPending ||
    deleteCategoryMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-[#0f0f0f] w-full max-w-4xl rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold">Preferences & Budgets</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: Financial Profile */}
          <section className="space-y-8">
            <div className="space-y-6">
              <h3 className="text-xs uppercase font-bold tracking-widest text-indigo-400">Monthly Allowance</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-500">Total Monthly Income</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                      {localSettings.currency}
                    </span>
                    <input
                      type="number"
                      value={localSettings.monthlyIncome}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, monthlyIncome: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Budget Summary Card */}
            <div className="p-6 rounded-2xl bg-indigo-600/5 border border-indigo-500/10 space-y-4">
              <h3 className="text-[10px] uppercase font-bold tracking-widest text-indigo-300">
                Monthly Distribution Summary
              </h3>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Allocated</span>
                  <span className="font-mono text-white font-bold">
                    {localSettings.currency}
                    {Math.round(budgetStats.totalMonthlyBudget).toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${budgetStats.leftover < 0 ? 'bg-red-500' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.min(budgetStats.percentageUsed, 100)}%` }}
                  />
                </div>
              </div>

              <div
                className={`flex items-center gap-3 p-4 rounded-xl ${budgetStats.leftover < 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}
              >
                {budgetStats.leftover < 0 ? (
                  <AlertCircle className="text-red-400" />
                ) : (
                  <CheckCircle2 className="text-emerald-400" />
                )}
                <div>
                  <p className={`text-xs font-bold ${budgetStats.leftover < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {budgetStats.leftover < 0 ? 'Budget Overflow' : 'Leftover Monthly Allowance'}
                  </p>
                  <p className="text-xl font-bold font-mono">
                    {localSettings.currency}
                    {Math.abs(Math.round(budgetStats.leftover)).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                * Weekly budgets are multiplied by 4.33 to calculate monthly totals.
              </p>
            </div>
          </section>

          {/* Right: Categories */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-bold tracking-widest text-indigo-400">Categorical Budgets</h3>
              <button
                onClick={addCategory}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-all"
              >
                <Plus size={14} />
                Add Category
              </button>
            </div>
            <div className="space-y-3">
              {localCategories.map((cat) => (
                <div key={cat.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={cat.color}
                      onChange={(e) => updateCategory(cat.id, { color: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none"
                    />
                    <input
                      value={cat.name}
                      onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
                      className="bg-transparent border-none text-base font-bold w-full p-0 focus:ring-0 text-white"
                      placeholder="Category Name"
                    />
                    <button onClick={() => deleteCategory(cat.id)} className="p-2 text-slate-600 hover:text-red-400">
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
                        {localSettings.currency}
                      </span>
                      <input
                        type="number"
                        value={cat.weeklyBudget}
                        onChange={(e) => updateCategory(cat.id, { weeklyBudget: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-7 pr-3 text-sm font-mono text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
                      {(['weekly', 'monthly'] as BudgetPeriod[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => updateCategory(cat.id, { period: p })}
                          className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                            cat.period === p ? 'bg-indigo-600 text-white' : 'text-slate-500'
                          }`}
                        >
                          {p.slice(0, 1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {localCategories.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-white/5 rounded-3xl">
                  <p className="text-sm text-slate-600">No categories added yet.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="p-6 bg-[#0a0a0a] border-t border-white/5 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 px-8 py-2 rounded-xl text-white font-bold shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
