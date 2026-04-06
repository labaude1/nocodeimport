import { useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, Square, RotateCcw, Download, ArrowLeft,
  Sliders, Zap, BarChart2, AlertTriangle, Activity, FlaskConical,
  Users, ShoppingCart, Package, ChevronRight, Loader2, Cpu
} from 'lucide-react';
import { useImportStore } from '../stores/importStore';
import { createApiClient } from '../lib/apiClient';
import { createImportEngine } from '../lib/importEngine';
import { formatNumber, formatFileSize, formatDuration } from '../lib/utils';
import FileDropZone from './FileDropZone';
import ProgressSection from './ProgressSection';
import LiveLog from './LiveLog';
import ErrorPanel from './ErrorPanel';
import toast from 'react-hot-toast';

export default function ImportDashboard() {
  const store = useImportStore();
  const {
    baseUrl, secretKey, file, fileSize,
    concurrency, delay, dryRun,
    importStatus, parseProgress, progress, currentPhase,
    logs, errors,
    setConcurrency, setDelay, setDryRun,
    setImportStatus, setCurrentPhase,
    updateParseProgress, initPhase, updatePhaseProgress, setPhaseComplete,
    startTimer, tickTimer,
    addLog, addError,
    setFinalResults, setTransformedData,
    setPage, resetImport, engineRef, setEngineRef,
  } = store;

  const timerRef = useRef(null);

  // Timer tick
  useEffect(() => {
    if (importStatus === 'inserting' || importStatus === 'parsing') {
      timerRef.current = setInterval(() => tickTimer(), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [importStatus]);

  const startImport = useCallback(async () => {
    if (!file) {
      toast.error('Veuillez sélectionner un fichier.');
      return;
    }

    resetImport();
    startTimer();
    setImportStatus('parsing');

    const apiClient = createApiClient(baseUrl, secretKey);

    const engine = createImportEngine(apiClient, {
      onParseProgress: (data) => {
        updateParseProgress(data);
      },
      onParseComplete: (data) => {
        addLog({ type: 'info', message: `Analyse terminée : ${formatNumber(data.customers)} clients, ${formatNumber(data.orders)} commandes, ${formatNumber(data.products)} produits` });
        toast.success(`Analyse : ${formatNumber(data.customers)} clients dédupliqués`, { duration: 4000 });
        setImportStatus('inserting');
      },
      onPhaseStart: (tableName, total) => {
        setCurrentPhase(tableName);
        initPhase(tableName, total);
        addLog({ type: 'info', message: `Début d'insertion : ${tableName} (${formatNumber(total)} enregistrements)` });
        if (!dryRun) toast(`⬆️ Insertion ${tableName}...`, { duration: 2000 });
      },
      onPhaseProgress: (tableName, data) => {
        updatePhaseProgress(tableName, data);
      },
      onPhaseComplete: (tableName, data) => {
        setPhaseComplete(tableName, data);
        addLog({
          type: data.failed > 0 ? 'warning' : 'success',
          message: `✓ ${tableName} : ${formatNumber(data.inserted)} insérés, ${formatNumber(data.failed)} échecs`,
        });
        if (data.inserted > 0) toast.success(`${tableName} terminé : ${formatNumber(data.inserted)} insérés`, { duration: 3000 });
      },
      onError: (err) => {
        addError(err);
        if (err.phase === 'parse') {
          addLog({ type: 'error', message: `Ligne ${err.lineNum} : ${err.error}` });
        }
      },
      onLog: (entry) => {
        addLog(entry);
      },
      onComplete: (results) => {
        setFinalResults(results);
        setImportStatus(results.dryRun ? 'done' : 'done');
        setCurrentPhase(null);
        clearInterval(timerRef.current);
        // Store transformed data for export
        const engineData = engine.getData();
        setTransformedData(engineData);
        addLog({
          type: 'success',
          message: results.dryRun
            ? '✅ Simulation terminée (aucun appel API effectué)'
            : '✅ Import terminé !',
        });
        if (results.dryRun) {
          toast.success('Simulation terminée !', { duration: 4000 });
        } else {
          toast.success('Import terminé avec succès !', { duration: 5000 });
          // Navigate to report
          setTimeout(() => setPage('report'), 1500);
        }
      },
    });

    setEngineRef(engine);

    try {
      await engine.run(file, { concurrency, delay, dryRun });
    } catch (e) {
      addLog({ type: 'error', message: `Erreur fatale : ${e.message}` });
      setImportStatus('idle');
      toast.error('Erreur fatale : ' + e.message);
    }
  }, [file, baseUrl, secretKey, concurrency, delay, dryRun]);

  const handlePause = () => {
    if (engineRef) {
      engineRef.pause();
      setImportStatus('paused');
      addLog({ type: 'warning', message: 'Import mis en pause...' });
      toast('⏸ Import mis en pause', { icon: '⏸' });
    }
  };

  const handleResume = () => {
    if (engineRef) {
      engineRef.resume();
      setImportStatus('inserting');
      addLog({ type: 'info', message: 'Reprise de l\'import...' });
      toast('▶️ Import repris');
    }
  };

  const handleCancel = () => {
    if (engineRef) {
      engineRef.cancel();
    }
    setImportStatus('cancelled');
    setCurrentPhase(null);
    clearInterval(timerRef.current);
    addLog({ type: 'warning', message: 'Import annulé.' });
    toast.error('Import annulé');
  };

  const handleRetry = async (failedErrors) => {
    if (!engineRef) return;
    toast('🔄 Relance des échecs...', { duration: 2000 });
    const results = await engineRef.retryFailed(failedErrors, concurrency, delay);
    toast.success('Rejouer terminé !');
    addLog({ type: 'info', message: `Rejouer : ${JSON.stringify(results)}` });
  };

  const exportTransformed = () => {
    const data = engineRef?.getData() || store.transformedData;
    if (!data) {
      toast.error('Aucune donnée transformée disponible.');
      return;
    }
    const files = [
      { name: 'customers.json', content: data.customers },
      { name: 'orders.json', content: data.orders },
      { name: 'products.json', content: data.products },
    ];
    for (const f of files) {
      const blob = new Blob([JSON.stringify(f.content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast.success('3 fichiers JSON exportés !');
  };

  const isRunning = importStatus === 'parsing' || importStatus === 'inserting';
  const isDone = importStatus === 'done' || importStatus === 'cancelled';
  const canStart = !isRunning && importStatus !== 'paused' && !!file;

  // Memory usage (if available)
  const memInfo = performance?.memory ? {
    used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(0),
    total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(0),
  } : null;

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage('config')}
              className="p-2 rounded-xl bg-[#132213] border border-[#2d4a2d] text-[#86a886]
                         hover:text-[#4ade80] hover:border-[#4ade80] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#e2f0e2]">Dashboard d'Import</h1>
              <p className="text-xs text-[#4d6b4d]">{baseUrl}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {memInfo && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#132213] border border-[#2d4a2d]">
                <Cpu className="w-3 h-3 text-[#4d6b4d]" />
                <span className="text-xs text-[#4d6b4d] font-mono">{memInfo.used}MB / {memInfo.total}MB</span>
              </div>
            )}
            {importStatus === 'done' && (
              <button
                onClick={() => setPage('report')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#166534] border border-[#22c55e]
                           text-white text-sm font-semibold hover:bg-[#15803d] transition-colors"
              >
                Voir le rapport <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            {/* Section A: File */}
            <div className="bg-[#132213] border border-[#2d4a2d] rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-[#86a886] mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#4ade80]" />
                A — Fichier source
              </h2>
              <FileDropZone />
            </div>

            {/* Section B: Controls */}
            <div className="bg-[#132213] border border-[#2d4a2d] rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-[#86a886] mb-4 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#4ade80]" />
                B — Paramètres d'import
              </h2>

              {/* Concurrency */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-[#86a886]">Requêtes parallèles</label>
                  <span className="text-sm font-bold text-[#4ade80] font-mono">{concurrency}</span>
                </div>
                <input
                  type="range" min={1} max={10} value={concurrency}
                  onChange={e => setConcurrency(Number(e.target.value))}
                  className="w-full" disabled={isRunning}
                />
                <div className="flex justify-between text-xs text-[#2d4a2d] mt-1">
                  <span>1</span><span>5</span><span>10</span>
                </div>
              </div>

              {/* Delay */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-[#86a886]">Délai entre lots</label>
                  <span className="text-sm font-bold text-[#4ade80] font-mono">{delay}ms</span>
                </div>
                <input
                  type="range" min={0} max={500} step={25} value={delay}
                  onChange={e => setDelay(Number(e.target.value))}
                  className="w-full" disabled={isRunning}
                />
                <div className="flex justify-between text-xs text-[#2d4a2d] mt-1">
                  <span>0ms</span><span>250ms</span><span>500ms</span>
                </div>
              </div>

              {/* Dry Run toggle */}
              <div className="flex items-center justify-between mb-5 p-3 bg-[#0d1a0d] rounded-xl border border-[#1f361f]">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-[#60a5fa]" />
                  <div>
                    <p className="text-xs font-medium text-[#e2f0e2]">Mode simulation</p>
                    <p className="text-xs text-[#4d6b4d]">Transforme sans envoyer à l'API</p>
                  </div>
                </div>
                <button
                  onClick={() => setDryRun(!dryRun)}
                  disabled={isRunning}
                  className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0
                    ${dryRun ? 'bg-[#1d4ed8]' : 'bg-[#1f361f]'}
                    disabled:opacity-50`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                    ${dryRun ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                {canStart && (
                  <button
                    onClick={startImport}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                               bg-[#166534] border border-[#22c55e] text-white font-semibold text-sm
                               hover:bg-[#15803d] transition-all shadow-lg shadow-[#4ade80]/10"
                  >
                    {dryRun ? <FlaskConical className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {dryRun ? 'Lancer la simulation' : 'Démarrer l\'import'}
                  </button>
                )}

                {isRunning && importStatus !== 'paused' && (
                  <button
                    onClick={handlePause}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                               bg-[#78350f] border border-[#fbbf24] text-[#fbbf24] font-semibold text-sm
                               hover:bg-[#92400e] transition-all"
                  >
                    <Pause className="w-4 h-4" /> Mettre en pause
                  </button>
                )}

                {importStatus === 'paused' && (
                  <button
                    onClick={handleResume}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                               bg-[#166534] border border-[#22c55e] text-white font-semibold text-sm
                               hover:bg-[#15803d] transition-all"
                  >
                    <Play className="w-4 h-4" /> Reprendre
                  </button>
                )}

                {(isRunning || importStatus === 'paused') && (
                  <button
                    onClick={handleCancel}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                               bg-[#7f1d1d] border border-[#f87171] text-[#f87171] font-semibold text-sm
                               hover:bg-[#991b1b] transition-all"
                  >
                    <Square className="w-4 h-4" /> Annuler
                  </button>
                )}

                {isDone && (
                  <button
                    onClick={exportTransformed}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                               bg-[#1f361f] border border-[#2d4a2d] text-[#86a886] text-sm
                               hover:border-[#4ade80] hover:text-[#4ade80] transition-all"
                  >
                    <Download className="w-4 h-4" /> Exporter données transformées
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMNS (2-column span) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Parse progress (visible during parsing) */}
            {(importStatus === 'parsing' || parseProgress.linesProcessed > 0) && (
              <div className="bg-[#132213] border border-[#2d4a2d] rounded-2xl p-5 animate-fade-in">
                <h2 className="text-sm font-semibold text-[#86a886] mb-4 flex items-center gap-2">
                  <Loader2 className={`w-4 h-4 ${importStatus === 'parsing' ? 'animate-spin text-[#4ade80]' : 'text-[#4d6b4d]'}`} />
                  Analyse du fichier
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#0d1a0d] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#e2f0e2] font-mono-num">
                      {formatNumber(parseProgress.linesProcessed)}
                    </p>
                    <p className="text-xs text-[#4d6b4d]">Lignes lues</p>
                  </div>
                  <div className="bg-[#0d1a0d] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#4ade80] font-mono-num">
                      {formatNumber(parseProgress.customers)}
                    </p>
                    <p className="text-xs text-[#4d6b4d]">Clients uniques</p>
                  </div>
                  <div className="bg-[#0d1a0d] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#60a5fa] font-mono-num">
                      {formatNumber(parseProgress.orders)}
                    </p>
                    <p className="text-xs text-[#4d6b4d]">Commandes</p>
                  </div>
                  <div className="bg-[#0d1a0d] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#fbbf24] font-mono-num">
                      {formatNumber(parseProgress.products)}
                    </p>
                    <p className="text-xs text-[#4d6b4d]">Produits</p>
                  </div>
                </div>
                {parseProgress.totalBytes > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-[#4d6b4d] mb-1">
                      <span>Lecture du fichier</span>
                      <span>{Math.round((parseProgress.bytesRead / parseProgress.totalBytes) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-[#1f361f] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#4ade80] transition-all duration-300"
                        style={{ width: `${Math.round((parseProgress.bytesRead / parseProgress.totalBytes) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section C: Progress */}
            {(importStatus === 'inserting' || importStatus === 'paused' || isDone) && (
              <div className="bg-[#132213] border border-[#2d4a2d] rounded-2xl p-5 animate-fade-in">
                <h2 className="text-sm font-semibold text-[#86a886] mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#4ade80]" />
                  C — Progression en temps réel
                  {importStatus === 'paused' && (
                    <span className="ml-2 text-xs bg-[#78350f] text-[#fbbf24] px-2 py-0.5 rounded-full">
                      En pause
                    </span>
                  )}
                  {importStatus === 'done' && (
                    <span className="ml-2 text-xs bg-[#0d250d] text-[#4ade80] px-2 py-0.5 rounded-full">
                      Terminé
                    </span>
                  )}
                </h2>
                <ProgressSection
                  progress={progress}
                  currentPhase={currentPhase}
                  importStatus={importStatus}
                />
              </div>
            )}

            {/* Live log */}
            {(logs.length > 0 || isRunning) && (
              <div className="bg-[#132213] border border-[#2d4a2d] rounded-2xl p-5 animate-fade-in">
                <h2 className="text-sm font-semibold text-[#86a886] mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#4ade80]" />
                  Journal en direct
                  {isRunning && <span className="w-2 h-2 bg-[#4ade80] rounded-full pulse-green" />}
                </h2>
                <LiveLog logs={logs} />
              </div>
            )}

            {/* Error panel */}
            {errors.length > 0 && (
              <div className="animate-fade-in">
                <ErrorPanel onRetry={handleRetry} />
              </div>
            )}

            {/* Dry run result */}
            {importStatus === 'done' && store.finalResults?.dryRun && (
              <div className="bg-[#0d1825] border border-[#1e3a5f] rounded-2xl p-5 animate-fade-in">
                <h2 className="text-sm font-semibold text-[#60a5fa] mb-4 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4" />
                  Résultats de la simulation
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Clients dédupliqués', value: store.finalResults.customers, icon: Users, color: 'text-[#4ade80]' },
                    { label: 'Commandes', value: store.finalResults.orders, icon: ShoppingCart, color: 'text-[#60a5fa]' },
                    { label: 'Produits', value: store.finalResults.products, icon: Package, color: 'text-[#fbbf24]' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-[#0a1520] rounded-xl p-3 text-center border border-[#1e3a5f]">
                      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                      <p className={`text-2xl font-bold font-mono-num ${color}`}>{formatNumber(value)}</p>
                      <p className="text-xs text-[#4d6b4d] mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
