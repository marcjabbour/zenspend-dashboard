
import React, { useState } from 'react';
import { Transaction, Category } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { BarChart3 } from 'lucide-react';

interface CalendarProps {
  currentDate: Date;
  transactions: Transaction[];
  categories: Category[];
  onDayClick: (date: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onViewWeeklySummary: (start: Date, end: Date) => void;
  onMoveTransaction?: (txId: string, newDate: string, groupId?: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({
  currentDate,
  transactions,
  categories,
  onDayClick,
  onEditTransaction,
  onViewWeeklySummary,
  onMoveTransaction
}) => {
  const [draggedTx, setDraggedTx] = useState<Transaction | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = new Date().toLocaleDateString('en-CA');

  const calendarDays: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    calendarDays.push(d.toLocaleDateString('en-CA'));
  }

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const getDayTransactions = (dateStr: string) => {
    return transactions.filter(tx => tx.date === dateStr);
  };

  return (
    <div className="bg-white/5 flex flex-col gap-px">
      <div className="grid grid-cols-[repeat(7,1fr)_40px] gap-px">
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="bg-[#0f0f0f] py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">{day}</div>
        ))}
        <div className="bg-[#0f0f0f]" />
      </div>
      
      {weeks.map((week, wIdx) => {
        const validDays = week.filter(d => d !== null) as string[];
        const weekStart = new Date(validDays[0]);
        const weekEnd = new Date(validDays[validDays.length - 1]);

        return (
          <div key={`week-${wIdx}`} className="grid grid-cols-[repeat(7,1fr)_40px] gap-px group/row">
            {week.map((dateStr, dIdx) => {
              if (!dateStr) return <div key={`empty-${wIdx}-${dIdx}`} className="bg-[#0a0a0a] min-h-[140px]" />;

              const dayTxs = getDayTransactions(dateStr);
              const isToday = dateStr === todayStr;
              const dayNum = parseInt(dateStr.split('-')[2]);

              const isDropTarget = dropTarget === dateStr;

              return (
                <div
                  key={dateStr}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) onDayClick(dateStr);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedTx && draggedTx.date !== dateStr) {
                      setDropTarget(dateStr);
                    }
                  }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedTx && draggedTx.date !== dateStr && onMoveTransaction) {
                      onMoveTransaction(draggedTx.id, dateStr, draggedTx.groupId);
                    }
                    setDraggedTx(null);
                    setDropTarget(null);
                  }}
                  className={`bg-[#0a0a0a] min-h-[140px] p-2 transition-all hover:bg-white/[0.02] cursor-pointer group flex flex-col relative border-r border-white/[0.02] ${isToday ? 'ring-1 ring-inset ring-indigo-500/50' : ''} ${isDropTarget ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-500/10' : ''}`}
                >
                  <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-lg mb-2 pointer-events-none ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                    {dayNum}
                  </span>

                  <div className="space-y-1 overflow-y-auto flex-1 pb-1 custom-scrollbar max-h-[90px]">
                    {dayTxs.map(tx => {
                      const cat = categories.find(c => c.id === tx.categoryId);
                      const catColor = cat?.color || (tx.categoryId === 'fixed' ? '#94a3b8' : '#ffffff20');
                      const isDragging = draggedTx?.id === tx.id;

                      return (
                        <div
                          key={tx.id}
                          draggable
                          onDragStart={() => setDraggedTx(tx)}
                          onDragEnd={() => {
                            setDraggedTx(null);
                            setDropTarget(null);
                          }}
                          onClick={(e) => { e.stopPropagation(); onEditTransaction(tx); }}
                          className={`flex items-center gap-1 text-[9px] rounded px-1 py-0.5 border cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all ${isDragging ? 'opacity-50 scale-95' : ''}`}
                          style={{
                            borderColor: `${catColor}50`,
                            backgroundColor: `${catColor}15`,
                            color: catColor
                          }}
                        >
                          <span className="truncate flex-1 max-w-[60px]" title={tx.description}>{tx.description}</span>
                          <span className="font-mono font-bold shrink-0">${Math.round(tx.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="bg-[#0a0a0a] flex items-center justify-center border-l border-white/[0.02]">
               <button 
                onClick={() => onViewWeeklySummary(weekStart, weekEnd)}
                className="p-2 text-slate-600 hover:text-indigo-400 hover:bg-white/5 rounded-full transition-all opacity-0 group-hover/row:opacity-100"
               >
                 <BarChart3 size={18} />
               </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Calendar;
