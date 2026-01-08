
import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff, Sparkles, Loader2, CheckCircle2, History } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { Transaction, Category, UserSettings } from '../types';

interface LiveAgentOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  settings: UserSettings;
  onLogTransaction: (tx: Omit<Transaction, 'id'>) => void;
}

const logTransactionTool: FunctionDeclaration = {
  name: 'log_transaction',
  parameters: {
    type: Type.OBJECT,
    description: 'Log a new expense or income entry into the users budget.',
    properties: {
      amount: { type: Type.NUMBER, description: 'The currency amount.' },
      description: { type: Type.STRING, description: 'Brief description of the item.' },
      categoryId: { type: Type.STRING, description: 'The ID of the category.' },
      date: { type: Type.STRING, description: 'ISO date string YYYY-MM-DD.' },
      type: { type: Type.STRING, description: 'expense, income, or cc_payment.' },
      isFixed: { type: Type.BOOLEAN, description: 'Whether this is a recurring fixed cost like rent or subscriptions.' }
    },
    required: ['amount', 'description', 'categoryId', 'date', 'type']
  }
};

const LiveAgentOverlay: React.FC<LiveAgentOverlayProps> = ({ isOpen, onClose, transactions, categories, settings, onLogTransaction }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState('Standby');
  const [activityLog, setActivityLog] = useState<{msg: string, type: 'success' | 'info'}[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const addLog = (msg: string, type: 'success' | 'info' = 'info') => {
    setActivityLog(prev => [{msg, type}, ...prev].slice(0, 3));
  };

  const startSession = async () => {
    setIsConnecting(true);
    setStatus('Initializing AI...');
    
    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [logTransactionTool] }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are a professional financial assistant for ZenSpend. 
          Your job is to help the user track their budget through voice.
          
          When a user mentions an expense, IMMEDIATELY call 'log_transaction'.
          Categories: ${categories.map(c => `${c.id} (${c.name})`).join(', ')}.
          Default Category for Fixed Costs: 'fixed'.
          
          Current State:
          - Currency: ${settings.currency}
          - Monthly Allowance: ${settings.currency}${settings.monthlyIncome}
          - Today's Date: ${new Date().toLocaleDateString('en-CA')}
          
          Be helpful and conversational. If they ask "where am I at?", calculate their total variable spending for the current month or week based on their allowance. 
          Confirm every successful log with a short, friendly audio response.`,
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            setStatus('Listening...');
            
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const input = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(input.length);
              for (let i = 0; i < input.length; i++) int16[i] = input[i] * 32768;
              
              const binary = '';
              const bytes = new Uint8Array(int16.buffer);
              let b64 = '';
              for (let i = 0; i < bytes.byteLength; i++) b64 += String.fromCharCode(bytes[i]);
              
              sessionPromise.then(s => {
                s.sendRealtimeInput({ media: { data: btoa(b64), mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'log_transaction') {
                  const args = fc.args as any;
                  onLogTransaction({
                    amount: args.amount,
                    description: args.description,
                    categoryId: args.categoryId,
                    date: args.date,
                    type: args.type,
                    isFixed: args.isFixed || args.categoryId === 'fixed'
                  });
                  addLog(`Logged ${settings.currency}${args.amount} for ${args.description}`, 'success');
                  
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: "Success: Transaction recorded in the database." } }
                  }));
                }
              }
            }

            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              setStatus('Speaking...');
              const binary = atob(audioData);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              
              const int16 = new Int16Array(bytes.buffer);
              const buffer = outputCtx.createBuffer(1, int16.length, 24000);
              const channelData = buffer.getChannelData(0);
              for (let i = 0; i < int16.length; i++) channelData[i] = int16[i] / 32768.0;

              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setStatus('Listening...');
              };
            }
          },
          onclose: () => stopSession(),
          onerror: (e) => console.error("Live API Error", e)
        }
      });
      sessionRef.current = sessionPromise;
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    setIsActive(false);
    setIsConnecting(false);
    setStatus('Disconnected');
    if (sessionRef.current) sessionRef.current.then((s: any) => s.close());
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
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
