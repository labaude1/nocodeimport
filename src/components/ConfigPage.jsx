import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, Wifi, ArrowRight, Leaf, Key, Globe } from 'lucide-react';
import { useImportStore } from '../stores/importStore';
import { createApiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

export default function ConfigPage() {
  const {
    baseUrl, secretKey, connectionStatus, connectionMessage,
    setConfig, setConnectionStatus, setPage
  } = useImportStore();

  const [localUrl, setLocalUrl] = useState(baseUrl);
  const [localKey, setLocalKey] = useState(secretKey);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!localUrl || !localKey) {
      toast.error('Veuillez renseigner l\'URL et la clé secrète.');
      return;
    }
    setTesting(true);
    setConnectionStatus('testing');
    setConfig(localUrl, localKey);

    const client = createApiClient(localUrl, localKey);
    const result = await client.testConnection('customers');

    setTesting(false);
    if (result.ok) {
      setConnectionStatus('ok', `Connexion réussie (HTTP ${result.status})`);
      toast.success('Connexion Nocodebackend vérifiée !', { className: 'toast-success' });
    } else {
      setConnectionStatus('error', result.message);
      toast.error(result.message, { className: 'toast-error' });
    }
  };

  const handleProceed = () => {
    setConfig(localUrl, localKey);
    setPage('import');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl animate-fade-in">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1f361f] border border-[#2d4a2d] flex items-center justify-center">
              <Leaf className="w-6 h-6 text-[#4ade80]" />
            </div>
            <h1 className="text-3xl font-bold text-[#e2f0e2] tracking-tight">
              NCB Import
            </h1>
          </div>
          <p className="text-[#86a886] text-sm">
            Importateur JSONL vers Nocodebackend — Configuration de la connexion
          </p>
        </div>

        {/* Config Card */}
        <div className="bg-[#132213] border border-[#2d4a2d] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-[#e2f0e2] mb-6 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-[#4ade80]" />
            Paramètres API
          </h2>

          {/* Base URL */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-[#86a886] mb-2">
              URL de base Nocodebackend
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4d6b4d]" />
              <input
                type="url"
                value={localUrl}
                onChange={e => setLocalUrl(e.target.value)}
                placeholder="https://app.nocodebackend.com/api/v1"
                className="w-full bg-[#0d1a0d] border border-[#2d4a2d] rounded-xl pl-10 pr-4 py-3
                           text-[#e2f0e2] placeholder-[#4d6b4d] text-sm
                           focus:outline-none focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30
                           transition-colors"
              />
            </div>
            <p className="mt-1 text-xs text-[#4d6b4d]">
              Exemple : https://app.nocodebackend.com/api/v1 — sans slash final
            </p>
          </div>

          {/* Secret Key */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#86a886] mb-2">
              Clé secrète (Bearer Token)
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4d6b4d]" />
              <input
                type="text"
                value={localKey}
                onChange={e => setLocalKey(e.target.value)}
                placeholder="ncb_..."
                className="w-full bg-[#0d1a0d] border border-[#2d4a2d] rounded-xl pl-10 pr-4 py-3
                           text-[#e2f0e2] placeholder-[#4d6b4d] text-sm font-mono
                           focus:outline-none focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30
                           transition-colors"
              />
            </div>
            <p className="mt-1 text-xs text-[#4d6b4d]">
              Vérifiez dans votre dashboard Nocodebackend → Settings → API Keys
            </p>
          </div>

          {/* Connection Status */}
          {connectionStatus && connectionStatus !== 'testing' && (
            <div className={`mb-5 flex items-center gap-2 p-3 rounded-xl text-sm
              ${connectionStatus === 'ok'
                ? 'bg-[#0d250d] border border-[#166534] text-[#4ade80]'
                : 'bg-[#250d0d] border border-[#7f1d1d] text-[#f87171]'
              }`}>
              {connectionStatus === 'ok'
                ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                : <XCircle className="w-4 h-4 flex-shrink-0" />
              }
              <span>{connectionMessage}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testing || !localUrl || !localKey}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1f361f] border border-[#2d4a2d]
                         text-[#e2f0e2] text-sm font-medium hover:border-[#4ade80] hover:text-[#4ade80]
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              {testing ? 'Test en cours...' : 'Tester la connexion'}
            </button>

            <button
              onClick={handleProceed}
              disabled={connectionStatus !== 'ok'}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                         bg-[#166534] border border-[#22c55e] text-white text-sm font-semibold
                         hover:bg-[#15803d] disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-200 shadow-lg shadow-[#4ade80]/10"
            >
              Accéder à l'import
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="mt-4 bg-[#132213] border border-[#2d4a2d] rounded-xl p-4">
          <p className="text-xs text-[#4d6b4d] leading-relaxed">
            <span className="text-[#86a886] font-medium">ℹ️ Avant l'import :</span>{' '}
            Assurez-vous que les tables <code className="text-[#4ade80] bg-[#0d1a0d] px-1 rounded">customers</code>,{' '}
            <code className="text-[#4ade80] bg-[#0d1a0d] px-1 rounded">orders</code> et{' '}
            <code className="text-[#4ade80] bg-[#0d1a0d] px-1 rounded">customer_products</code>{' '}
            ont été créées dans votre projet Nocodebackend.
          </p>
        </div>
      </div>
    </div>
  );
}
