import { useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

const TYPE_CONFIG = {
  success: { icon: CheckCircle, color: 'text-[#4ade80]', bg: 'bg-[#0d250d]', label: 'OK' },
  error: { icon: XCircle, color: 'text-[#f87171]', bg: 'bg-[#250d0d]', label: 'ERR' },
  warning: { icon: AlertTriangle, color: 'text-[#fbbf24]', bg: 'bg-[#251a0d]', label: 'WARN' },
  info: { icon: Info, color: 'text-[#60a5fa]', bg: 'bg-[#0d1825]', label: 'INFO' },
};

function LogEntry({ entry }) {
  const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;

  const time = new Date(entry.ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  let msg = '';
  if (entry.message) {
    msg = entry.message;
  } else if (entry.table) {
    if (entry.type === 'success') {
      msg = `[${entry.table}] ✓ ${entry.id || ''} — HTTP ${entry.status || ''}`;
    } else {
      msg = `[${entry.table}] ✗ ${entry.id || ''} — ${entry.error || `HTTP ${entry.status}`}`;
    }
  }

  return (
    <div className={`flex items-start gap-2 py-1.5 px-2 rounded-lg text-xs animate-slide-in ${cfg.bg} mb-0.5`}>
      <span className="text-[#4d6b4d] font-mono flex-shrink-0 mt-0.5">{time}</span>
      <Icon className={`w-3 h-3 flex-shrink-0 mt-0.5 ${cfg.color}`} />
      <span className={`${cfg.color} font-mono flex-shrink-0`}>[{cfg.label}]</span>
      <span className="text-[#86a886] truncate">{msg}</span>
    </div>
  );
}

export default function LiveLog({ logs }) {
  const containerRef = useRef(null);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    // Auto-scroll to top when new entries added (logs are prepended)
    if (logs.length !== prevLengthRef.current) {
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
      prevLengthRef.current = logs.length;
    }
  }, [logs.length]);

  return (
    <div
      ref={containerRef}
      className="h-40 overflow-y-auto bg-[#050d05] border border-[#1a2e1a] rounded-xl p-2 font-mono"
    >
      {logs.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-xs text-[#2d4a2d]">En attente d'activité...</p>
        </div>
      ) : (
        logs.map(entry => (
          <LogEntry key={entry.id} entry={entry} />
        ))
      )}
    </div>
  );
}
