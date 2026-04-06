import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Download, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { useImportStore } from '../stores/importStore';
import { formatNumber } from '../lib/utils';
import toast from 'react-hot-toast';

export default function ErrorPanel({ onRetry }) {
  const { errors, clearErrors } = useImportStore();
  const [expanded, setExpanded] = useState(false);
  const [selectedError, setSelectedError] = useState(null);

  if (errors.length === 0) return null;

  const exportErrors = () => {
    const blob = new Blob([JSON.stringify(errors, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ncb-errors-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Erreurs exportées !');
  };

  // Errors with actual API records (not parse errors)
  const retryableErrors = errors.filter(e => e.record && e.phase !== 'parse');

  return (
    <div className="bg-[#1a0d0d] border border-[#7f1d1d] rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#250d0d] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#f87171]" />
          <span className="text-sm font-semibold text-[#f87171]">
            {formatNumber(errors.length)} erreur{errors.length > 1 ? 's' : ''}
          </span>
          <span className="text-xs text-[#7f1d1d] bg-[#250d0d] px-2 py-0.5 rounded-full">
            {retryableErrors.length} rejouable{retryableErrors.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="w-4 h-4 text-[#f87171]" /> : <ChevronDown className="w-4 h-4 text-[#f87171]" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[#7f1d1d]/50">
          {/* Actions */}
          <div className="flex gap-2 p-3 border-b border-[#7f1d1d]/30">
            <button
              onClick={exportErrors}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#250d0d] border border-[#7f1d1d]
                         text-xs text-[#f87171] hover:bg-[#3b0d0d] transition-colors"
            >
              <Download className="w-3 h-3" />
              Exporter JSON
            </button>
            {retryableErrors.length > 0 && onRetry && (
              <button
                onClick={() => onRetry(retryableErrors)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2e1a] border border-[#2d4a2d]
                           text-xs text-[#4ade80] hover:bg-[#1f361f] transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Rejouer {retryableErrors.length} échec{retryableErrors.length > 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={() => clearErrors()}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#333]
                         text-xs text-[#4d6b4d] hover:text-[#f87171] transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Vider
            </button>
          </div>

          {/* Error list */}
          <div className="max-h-64 overflow-y-auto p-3 space-y-2">
            {errors.slice(0, 100).map(err => (
              <div
                key={err.id}
                className="bg-[#0d0505] border border-[#7f1d1d]/30 rounded-lg p-3 cursor-pointer
                           hover:border-[#f87171]/50 transition-colors"
                onClick={() => setSelectedError(selectedError?.id === err.id ? null : err)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <XCircle className="w-3.5 h-3.5 text-[#f87171] flex-shrink-0" />
                    <span className="text-xs text-[#f87171] font-medium truncate">
                      [{err.phase || 'unknown'}] {err.identifier || err.lineNum || 'N/A'}
                    </span>
                  </div>
                  <span className="text-xs text-[#7f1d1d] flex-shrink-0 font-mono">
                    HTTP {err.status || 0}
                  </span>
                </div>
                <p className="text-xs text-[#86a886] mt-1 truncate">{err.error}</p>

                {/* Expanded detail */}
                {selectedError?.id === err.id && err.record && (
                  <div className="mt-2 p-2 bg-[#0a0a0a] rounded border border-[#333]">
                    <p className="text-xs text-[#4d6b4d] mb-1">Données envoyées :</p>
                    <pre className="text-xs text-[#86a886] overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(err.record, null, 2).substring(0, 500)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
            {errors.length > 100 && (
              <p className="text-xs text-[#4d6b4d] text-center py-2">
                … et {formatNumber(errors.length - 100)} autres erreurs (exportez pour voir tout)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
