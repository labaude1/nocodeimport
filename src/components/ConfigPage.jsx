import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, Wifi, ArrowRight, Leaf, Key, Globe, Database } from 'lucide-react';
import { useImportStore } from '../stores/importStore';
import { createApiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

const DEFAULT_API_ROOT = 'https://api.nocodebackend.com';
const DEFAULT_SECRET_KEY = 'e2871fe4f3d7a7f2af5f58a973db58942ce304633dd001efc281d1164890';
const DEFAULT_INSTANCE = '44716_e_commerce_order_import';

export default function ConfigPage() {
  const {
    baseUrl, instanceName: storedInstance, secretKey, connectionStatus, connectionMessage,
    setFullConfig, setConnectionStatus, setPage
  } = useImportStore();

  // Parse stored baseUrl to extract parts (backward compat)
  const [apiRoot, setApiRoot] = useState(() => {
    if (baseUrl && baseUrl.includes('nocodebackend.com')) {
      try { return new URL(baseUrl).origin; } catch { return baseUrl; }
    }
    return baseUrl || DEFAULT_API_ROOT;
  });
  const [instanceName, setInstanceName] = useState(storedInstance || DEFAULT_INSTANCE);
  const [localKey, setLocalKey] = useState(secretKey || DEFAULT_SECRET_KEY);
  const [testing, setTesting] = useState(false);
  const [testDetails, setTestDetails] = useState(null);

  const handleTest = async () => {
    if (!apiRoot || !localKey || !instanceName) {
      toast.error('Veuillez renseigner tous les champs.');
      return;
    }
    setTesting(true);
    setConnectionStatus('testing');
    setTestDetails(null);

    // Save to store
    setFullConfig(apiRoot, instanceName, localKey);

    const client = createApiClient(apiRoot, localKey, instanceName);
    const result = await client.testConnection('customers');

    setTesting(false);
    setTestDetails({ url: result.url, status: result.status });

    if (result.ok) {
      setConnectionStatus('ok', `Connexion réussie (HTTP ${result.status})`);
      toast.success('Connexion Nocodebackend vérifiée !');
    } else {
      setConnectionStatus('error', result.message);
      toast.error(result.message);
    }
  };

  const handleProceed = () => {
    setFullConfig(apiRoot, instanceName, localKey);
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
            Paramètres API Nocodebackend
          </h2>

          {/* API Root URL */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-[#86a886] mb-2">
              URL de base de l'API
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4d6b4d]" />
              <input
                type="url"
                value={apiRoot}
                onChange={e => setApiRoot(e.target.value.replace(/\/$/, ''))}
                placeholder="https://api.nocodebackend.com"
                className="w-full bg-[#0d1a0d] border border-[#2d4a2d] rounded-xl pl-10 pr-4 py-3
                           text-[#e2f0e2] placeholder-[#4d6b4d] text-sm font-mono
                           focus:outline-none focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30
                           transition-colors"
              />
            </div>
            <p className="mt-1 text-xs text-[#4d6b4d]">
              L'app construira automatiquement : <code className="text-[#4ade80]">{apiRoot}/create/customers?Instance=...</code>
            </p>
          </div>

          {/* Instance Name */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-[#86a886] mb-2">
              Nom de l'instance (base de données)
            </label>
            <div className="relative">
              <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4d6b4d]" />
              <input
                type="text"
                value={instanceName}
                onChange={e => setInstanceName(e.target.value)}
                placeholder="44716_e_commerce_order_import"
                className="w-full bg-[#0d1a0d] border border-[#2d4a2d] rounded-xl pl-10 pr-4 py-3
                           text-[#e2f0e2] placeholder-[#4d6b4d] text-sm font-mono
                           focus:outline-none focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30
                           transition-colors"
              />
            </div>
            <p className="mt-1 text-xs text-[#4d6b4d]">
              Paramètre <code className="text-[#4ade80]">?Instance=</code> visible dans l'URL de votre Swagger Nocodebackend
            </p>
          </div>

          {/* Secret Key */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#86a886] mb-2">
              Clé API (Bearer Token)
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4d6b4d]" />
              <input
                type="text"
                value={localKey}
                onChange={e => setLocalKey(e.target.value)}
                placeholder="e2871fe4..."
                className="w-full bg-[#0d1a0d] border border-[#2d4a2d] rounded-xl pl-10 pr-4 py-3
                           text-[#e2f0e2] placeholder-[#4d6b4d] text-sm font-mono
                           focus:outline-none focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30
                           transition-colors"
              />
            </div>
            <p className="mt-1 text-xs text-[#4d6b4d]">
              Clé API REST depuis votre dashboard Nocodebackend (≠ token MCP)
            </p>
          </div>

          {/* URL preview */}
          {apiRoot && instanceName && (
            <div className="mb-5 p-3 bg-[#0d1a0d] rounded-xl border border-[#1f361f]">
              <p className="text-xs text-[#4d6b4d] mb-1">URL qui sera utilisée pour l'insert :</p>
              <code className="text-xs text-[#4ade80] break-all">
                POST {apiRoot}/create/customers?Instance={instanceName}
              </code>
            </div>
          )}

          {/* Connection Status */}
          {connectionStatus && connectionStatus !== 'testing' && (
            <div className={`mb-5 flex items-start gap-2 p-3 rounded-xl text-sm
              ${connectionStatus === 'ok'
                ? 'bg-[#0d250d] border border-[#166534] text-[#4ade80]'
                : 'bg-[#250d0d] border border-[#7f1d1d] text-[#f87171]'
              }`}>
              {connectionStatus === 'ok'
                ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              }
              <div>
                <p>{connectionMessage}</p>
                {testDetails?.url && (
                  <p className="text-xs opacity-60 mt-1 font-mono break-all">{testDetails.url}</p>
                )}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testing || !apiRoot || !localKey || !instanceName}
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
            <span className="text-[#86a886] font-medium">ℹ️ Format Nocodebackend V2 :</span>{' '}
            L'API utilise les préfixes{' '}
            <code className="text-[#4ade80] bg-[#0d1a0d] px-1 rounded">/create/</code> pour insérer et{' '}
            <code className="text-[#4ade80] bg-[#0d1a0d] px-1 rounded">/read/</code> pour lire,
            avec le nom de la base en paramètre <code className="text-[#4ade80] bg-[#0d1a0d] px-1 rounded">?Instance=</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
