
import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff, Loader2, CheckCircle2 } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { Category, UserSettings } from '../types';

const API_BASE = 'http://localhost:3001/api';

interface LiveAgentOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  settings: UserSettings;
  onTransactionChange: () => void;
}

// All MCP tools converted to Gemini FunctionDeclaration format
const tools: FunctionDeclaration[] = [
  {
    name: 'log_transaction',
    description: 'Log a new expense, income, or credit card payment.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: 'Amount in currency (e.g., 50 for $50)' },
        description: { type: Type.STRING, description: 'What was purchased (e.g., "Coffee at Starbucks")' },
        categoryId: { type: Type.STRING, description: 'Category ID: groceries, outings, misc, or fixed for recurring costs' },
        date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
        type: { type: Type.STRING, description: 'expense, income, or cc_payment' },
        isFixed: { type: Type.BOOLEAN, description: 'True for recurring monthly expenses like rent or subscriptions' }
      },
      required: ['amount', 'description', 'categoryId', 'date', 'type']
    }
  },
  {
    name: 'get_transactions',
    description: 'Get transactions with optional filters.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        startDate: { type: Type.STRING, description: 'Filter from date (YYYY-MM-DD)' },
        endDate: { type: Type.STRING, description: 'Filter to date (YYYY-MM-DD)' },
        categoryId: { type: Type.STRING, description: 'Filter by category ID' },
        type: { type: Type.STRING, description: 'Filter by type: expense, income, or cc_payment' }
      }
    }
  },
  {
    name: 'delete_transaction',
    description: 'Delete a transaction by ID.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'The transaction ID to delete' }
      },
      required: ['id']
    }
  },
  {
    name: 'get_spending_summary',
    description: 'Get a spending summary for a time period.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: { type: Type.STRING, description: 'week or month' }
      },
      required: ['period']
    }
  },
  {
    name: 'list_categories',
    description: 'List all budget categories with their budgets.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'get_budget_status',
    description: 'Get current budget status showing spending vs budget per category.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: { type: Type.STRING, description: 'week or month (default: month)' }
      }
    }
  },
  {
    name: 'get_settings',
    description: 'Get account settings including balances and income.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'update_balance',
    description: 'Update checking or credit card balance.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        checkingBalance: { type: Type.NUMBER, description: 'New checking account balance' },
        creditCardBalance: { type: Type.NUMBER, description: 'New credit card balance' }
      }
    }
  }
];

const LiveAgentOverlay: React.FC<LiveAgentOverlayProps> = ({ isOpen, onClose, categories, settings, onTransactionChange }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState('Standby');
  const [activityLog, setActivityLog] = useState<{msg: string, type: 'success' | 'info'}[]>([]);

  // All resources that need cleanup
  const sessionRef = useRef<any>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const addLog = (msg: string, type: 'success' | 'info' = 'info') => {
    setActivityLog(prev => [{msg, type}, ...prev].slice(0, 3));
  };

  // Handle tool calls by routing to backend API
  const handleToolCall = async (name: string, args: any): Promise<string> => {
    try {
      switch (name) {
        case 'log_transaction': {
          // If isFixed, create recurring transactions for 12 months
          if (args.isFixed) {
            const { isFixed, ...base } = args;
            const res = await fetch(`${API_BASE}/transactions/recurring`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ base: { ...base, isFixed: true }, months: 12 })
            });
            const data = await res.json();
            onTransactionChange();
            addLog(`Logged recurring ${settings.currency}${args.amount} for ${args.description}`, 'success');
            return `Recurring transaction created for 12 months: ${JSON.stringify(data.data)}`;
          }
          const res = await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
          });
          const data = await res.json();
          onTransactionChange();
          addLog(`Logged ${settings.currency}${args.amount} for ${args.description}`, 'success');
          return `Transaction logged: ${JSON.stringify(data.data)}`;
        }
        case 'get_transactions': {
          const params = new URLSearchParams();
          if (args.startDate) params.set('startDate', args.startDate);
          if (args.endDate) params.set('endDate', args.endDate);
          if (args.categoryId) params.set('categoryId', args.categoryId);
          if (args.type) params.set('type', args.type);
          const res = await fetch(`${API_BASE}/transactions?${params}`);
          const data = await res.json();
          return JSON.stringify(data.data);
        }
        case 'delete_transaction': {
          await fetch(`${API_BASE}/transactions/${args.id}`, { method: 'DELETE' });
          onTransactionChange();
          addLog(`Deleted transaction`, 'success');
          return 'Transaction deleted';
        }
        case 'get_spending_summary': {
          const now = new Date();
          let startDate: string, endDate: string;
          if (args.period === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const weekStart = new Date(now); weekStart.setDate(diff);
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
            startDate = weekStart.toISOString().split('T')[0];
            endDate = weekEnd.toISOString().split('T')[0];
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
          }
          const res = await fetch(`${API_BASE}/transactions?startDate=${startDate}&endDate=${endDate}`);
          const data = await res.json();
          const txs = data.data || [];
          let total = 0, fixed = 0;
          for (const tx of txs) {
            if (tx.type === 'expense') {
              total += tx.amount;
              if (tx.isFixed || tx.categoryId === 'fixed') fixed += tx.amount;
            }
          }
          addLog(`${args.period} summary: ${settings.currency}${total - fixed} variable`, 'info');
          return `Period: ${startDate} to ${endDate}. Total expenses: ${settings.currency}${total}. Fixed costs: ${settings.currency}${fixed}. Variable spending: ${settings.currency}${total - fixed}.`;
        }
        case 'list_categories': {
          const res = await fetch(`${API_BASE}/categories`);
          const data = await res.json();
          return JSON.stringify(data.data);
        }
        case 'get_budget_status': {
          const now = new Date();
          const period = args.period || 'month';
          let startDate: string, endDate: string;
          if (period === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const weekStart = new Date(now); weekStart.setDate(diff);
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
            startDate = weekStart.toISOString().split('T')[0];
            endDate = weekEnd.toISOString().split('T')[0];
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
          }
          const [txRes, catRes] = await Promise.all([
            fetch(`${API_BASE}/transactions?startDate=${startDate}&endDate=${endDate}`),
            fetch(`${API_BASE}/categories`)
          ]);
          const txs = (await txRes.json()).data || [];
          const cats = (await catRes.json()).data || [];
          const spent: Record<string, number> = {};
          for (const tx of txs) {
            if (tx.type === 'expense' && !tx.isFixed && tx.categoryId !== 'fixed') {
              spent[tx.categoryId] = (spent[tx.categoryId] || 0) + tx.amount;
            }
          }
          const status = cats.map((c: any) => {
            const s = spent[c.id] || 0;
            const b = c.period === 'weekly' && period === 'month' ? c.weeklyBudget * 4.33 : c.weeklyBudget;
            return `${c.name}: ${settings.currency}${s.toFixed(0)}/${settings.currency}${b.toFixed(0)} (${((s/b)*100).toFixed(0)}%)`;
          }).join(', ');
          return `Budget status (${period}): ${status}`;
        }
        case 'get_settings': {
          const res = await fetch(`${API_BASE}/settings`);
          const data = await res.json();
          return JSON.stringify(data.data);
        }
        case 'update_balance': {
          const res = await fetch(`${API_BASE}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...args, balanceAsOf: new Date().toISOString() })
          });
          const data = await res.json();
          addLog('Balance updated', 'success');
          return `Balances updated: ${JSON.stringify(data.data)}`;
        }
        default:
          return `Unknown tool: ${name}`;
      }
    } catch (err) {
      console.error(`Tool ${name} error:`, err);
      return `Error: ${err}`;
    }
  };

  const startSession = async () => {
    setIsConnecting(true);
    setStatus('Initializing AI...');

    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });

      // Create and store audio contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      // Get and store media stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: tools }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are a helpful financial assistant for ZenSpend. Help the user track expenses and understand their budget through voice.

Available categories: ${categories.map(c => `${c.id} (${c.name})`).join(', ')}. Use 'fixed' for recurring costs.
Today: ${new Date().toLocaleDateString('en-CA')}. Currency: ${settings.currency}.

When logging expenses, use today's date unless specified otherwise. Be conversational and confirm actions briefly.`
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            setStatus('Listening...');

            // Set up audio input pipeline and store processor ref
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (!sessionRef.current) return;
              const input = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(input.length);
              for (let i = 0; i < input.length; i++) int16[i] = input[i] * 32768;
              const bytes = new Uint8Array(int16.buffer);
              let b64 = '';
              for (let i = 0; i < bytes.byteLength; i++) b64 += String.fromCharCode(bytes[i]);
              session.sendRealtimeInput({ media: { data: btoa(b64), mimeType: 'audio/pcm;rate=16000' } });
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle tool calls
            if (msg.toolCall?.functionCalls) {
              for (const fc of msg.toolCall.functionCalls) {
                if (!fc.name) continue;
                const result = await handleToolCall(fc.name, fc.args);
                session.sendToolResponse({
                  functionResponses: [{ id: fc.id, name: fc.name, response: { result } }]
                });
              }
            }

            // Handle audio output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputCtx) {
              setStatus('Speaking...');
              const binary = atob(audioData);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

              const int16 = new Int16Array(bytes.buffer);
              const buffer = outputCtx.createBuffer(1, int16.length, 24000);
              const channelData = buffer.getChannelData(0);
              for (let i = 0; i < int16.length; i++) channelData[i] = int16[i] / 32768.0;

              const bufferSource = outputCtx.createBufferSource();
              bufferSource.buffer = buffer;
              bufferSource.connect(outputCtx.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              bufferSource.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(bufferSource);
              bufferSource.onended = () => {
                sourcesRef.current.delete(bufferSource);
                if (sourcesRef.current.size === 0) setStatus('Listening...');
              };
            }
          },
          onclose: () => stopSession(),
          onerror: (e) => { console.error('Live API Error', e); stopSession(); }
        }
      });
      sessionRef.current = session;
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
      setStatus('Error connecting');
    }
  };

  const stopSession = () => {
    // Stop media stream tracks (releases microphone)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect and close processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close audio contexts
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }

    // Stop any playing audio
    sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    // Close Gemini session
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch {}
      sessionRef.current = null;
    }

    setIsActive(false);
    setIsConnecting(false);
    setStatus('Standby');
  };

  useEffect(() => {
    if (isOpen) startSession();
    return () => stopSession();
  }, [isOpen]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg p-12 text-center flex flex-col items-center">
        <button onClick={onClose} className="absolute top-8 right-8 p-3 hover:bg-white/10 rounded-full transition-all text-slate-400">
          <X size={24} />
        </button>

        <div className="mb-12 relative">
          <div className={`absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full transition-all duration-1000 ${isActive ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`} />
          <div className={`w-32 h-32 rounded-full border-2 flex items-center justify-center transition-all duration-500 z-10 relative ${isActive ? 'border-indigo-500 shadow-[0_0_50px_rgba(99,102,241,0.3)]' : 'border-white/10'}`}>
            {isConnecting ? <Loader2 size={48} className="animate-spin text-indigo-400" /> : <Mic size={48} className={isActive ? 'text-indigo-400' : 'text-slate-600'} />}
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2 tracking-tight">Financial AI Assistant</h2>
        <div className="flex items-center gap-2 mb-8">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`} />
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">{status}</p>
        </div>

        <div className="w-full h-32 overflow-hidden flex flex-col gap-2 mb-8 pointer-events-none">
          {activityLog.map((log, i) => (
            <div key={i} className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl border animate-in slide-in-from-bottom-2 ${log.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
              {log.type === 'success' && <CheckCircle2 size={14} />}
              <span className="text-sm font-medium">{log.msg}</span>
            </div>
          ))}
          {activityLog.length === 0 && <p className="text-xs text-slate-600 italic">Listening for expenses...</p>}
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => isActive ? stopSession() : startSession()}
            className={`px-8 py-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${isActive ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30'}`}
          >
            {isActive ? <MicOff size={20}/> : <Mic size={20}/>}
            {isActive ? 'Stop Session' : 'Start Agent'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveAgentOverlay;
