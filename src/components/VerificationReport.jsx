import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, ArrowLeft, Download, FileText, Users, RefreshCw, Loader2 } from 'lucide-react';
import { useImportStore } from '../stores/importStore';
import { createApiClient } from '../lib/apiClient';
import { formatNumber, formatCurrency, formatDuration } from '../lib/utils';
import toast from 'react-hot-toast';

function StatCard({ label, value, sub, color = 'text-[#4ade80]' }) {
  return (
    <div className="bg-[#0d1a0d] border border-[#1f361f] rounded-xl p-4">
      <p className={`text-3xl font-bold font-mono-num ${color}`}>{value}</p>
      <p className="text-xs text-[#86a886] mt-1">{label}</p>
      {sub && <p className="text-xs text-[#4d6b4d] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function VerificationReport() {
  const {
    baseUrl, instanceName, secretKey, finalResults, progress, errors, transformedData,
    verificationResults, setVerificationResults, setPage
  } = useImportStore();

  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!verificationResults && transformedData) {
      runVerification();
    }
  }, []);

  const runVerification = async () => {
    if (!transformedData || !baseUrl || !secretKey) return;
    setVerifying(true);
    toast.loading('Vérification d\'échantillons...', { id: 'verify' });

    let apiRoot = baseUrl;
    let instName = instanceName || '';
    try {
      const u = new URL(baseUrl);
      apiRoot = u.origin;
      if (!instName) instName = u.searchParams.get('Instance') || '';
    } catch {}
    const client = createApiClient(apiRoot, secretKey, instName);
    const results = [];

    // Pick 10 random customers
    const customers = transformedData.customers || [];
    const orders = transformedData.orders || [];

    const sampleCustomers = customers.length > 0
      ? Array.from({ length: Math.min(10, customers.length) }, () =>
          customers[Math.floor(Math.random() * customers.length)])
      : [];

    const sampleOrders = orders.length > 0
      ? Array.from({ length: Math.min(10, orders.length) }, () =>
          orders[Math.floor(Math.random() * orders.length)])
      : [];

    for (const cust of sampleCustomers) {
      const res = await client.getRecords('customers', { email: cust.email });
      results.push({
        type: 'customer',
        identifier: cust.email,
        name: `${cust.first_name} ${cust.last_name}`.trim(),
        found: res.success && res.data && (Array.isArray(res.data) ? res.data.length > 0 : true),
        status: res.status,
      });
    }

    for (const order of sampleOrders) {
      const res = await client.getRecords('orders', { order_id: order.order_id });
      results.push({
        type: 'order',
        identifier: order.order_id,
        name: order.customer_email,
        found: res.success && res.data && (Array.isArray(res.data) ? res.data.length > 0 : true),
        status: res.status,
      });
    }

    setVerificationResults(results);
    const ok = results.filter(r => r.found).length;
    toast.success(`Vérification : ${ok}/${results.length} trouvés`, { id: 'verify', duration: 4000 });
    setVerifying(false);
  };

  const downloadReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      finalResults,
      progress,
      errors: errors.slice(0, 1000),
      verificationResults,
      summary: {
        totalCustomers: progress?.customers?.inserted || 0,
        totalOrders: progress?.orders?.inserted || 0,
        totalProducts: progress?.customer_products?.inserted || 0,
        totalErrors: errors.length,
        elapsedMs: progress?.elapsed || 0,
      },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ncb-rapport-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Rapport téléchargé !');
  };

  const downloadCustomersCsv = () => {
    const customers = transformedData?.customers || [];
    if (customers.length === 0) {
      toast.error('Aucune donnée client disponible.');
      return;
    }

    const headers = Object.keys(customers[0]);
    const rows = customers.map(c =>
      headers.map(h => {
        const val = c[h];
        const str = val === null || val === undefined ? '' : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`CSV exporté (${formatNumber(customers.length)} clients) !`);
  };

  const custInserted = progress?.customers?.inserted || 0;
  const ordInserted = progress?.orders?.inserted || 0;
  const prodInserted = progress?.customer_products?.inserted || 0;
  const custFailed = progress?.customers?.failed || 0;
  const ordFailed = progress?.orders?.failed || 0;
  const prodFailed = progress?.customer_products?.failed || 0;

  const verOk = verificationResults ? verificationResults.filter(r => r.found).length : 0;
  const verTotal = verificationResults ? verificationResults.length : 0;

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage('import')}
              className="p-2 rounded-xl bg-[#132213] border border-[#2d4a2d] text-[#86a886]
                         hover:text-[#4ade80] hover:border-[#4ade80] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#e2f0e2] flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#4ade80]" />
                Rapport d'import
              </h1>
              <p className="text-xs text-[#4d6b4d]">
                Terminé en {formatDuration(progress?.elapsed || 0)}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={downloadCustomersCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1f361f] border border-[#2d4a2d]
                         text-[#86a886] text-sm hover:border-[#4ade80] hover:text-[#4ade80] transition-colors"
            >
              <Users className="w-4 h-4" />
              CSV Clients
            </button>
            <button
              onClick={downloadReport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#166534] border border-[#22c55e]
                         text-white text-sm font-semibold hover:bg-[#15803d] transition-colors"
            >
              <Download className="w-4 h-4" />
              Rapport JSON
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="Clients insérés" value={formatNumber(custInserted)} color="text-[#4ade80]" />
          <StatCard label="Clients échecs" value={formatNumber(custFailed)} color={custFailed > 0 ? 'text-[#f87171]' : 'text-[#4d6b4d]'} />
          <StatCard label="Commandes insérées" value={formatNumber(ordInserted)} color="text-[#60a5fa]" />
          <StatCard label="Commandes échecs" value={formatNumber(ordFailed)} color={ordFailed > 0 ? 'text-[#f87171]' : 'text-[#4d6b4d]'} />
          <StatCard label="Produits insérés" value={formatNumber(prodInserted)} color="text-[#fbbf24]" />
          <StatCard label="Produits échecs" value={formatNumber(prodFailed)} color={prodFailed > 0 ? 'text-[#f87171]' : 'text-[#4d6b4d]'} />
        </div>

        {/* Summary table */}
        <div className="bg-[#132213] border border-[#2d4a2d] rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-[#86a886] mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#4ade80]" />
            Tableau récapitulatif
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f361f]">
                <th className="text-left py-2 text-xs text-[#4d6b4d] font-medium">Table</th>
                <th className="text-right py-2 text-xs text-[#4d6b4d] font-medium">Total</th>
                <th className="text-right py-2 text-xs text-[#4d6b4d] font-medium">Insérés</th>
                <th className="text-right py-2 text-xs text-[#4d6b4d] font-medium">Échecs</th>
                <th className="text-right py-2 text-xs text-[#4d6b4d] font-medium">Taux</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'customers', label: 'Clients', color: '#4ade80' },
                { name: 'orders', label: 'Commandes', color: '#60a5fa' },
                { name: 'customer_products', label: 'Produits', color: '#fbbf24' },
              ].map(({ name, label, color }) => {
                const s = progress?.[name] || {};
                const total = s.total || 0;
                const inserted = s.inserted || 0;
                const failed = s.failed || 0;
                const rate = total > 0 ? Math.round((inserted / total) * 100) : 0;
                return (
                  <tr key={name} className="border-b border-[#1f361f]/50">
                    <td className="py-3 font-mono text-xs" style={{ color }}>{label}</td>
                    <td className="py-3 text-right text-[#e2f0e2] font-mono-num">{formatNumber(total)}</td>
                    <td className="py-3 text-right text-[#4ade80] font-mono-num">{formatNumber(inserted)}</td>
                    <td className="py-3 text-right font-mono-num" style={{ color: failed > 0 ? '#f87171' : '#4d6b4d' }}>
                      {formatNumber(failed)}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${rate >= 95 ? 'bg-[#0d250d] text-[#4ade80]' : rate >= 80 ? 'bg-[#251a0d] text-[#fbbf24]' : 'bg-[#250d0d] text-[#f87171]'}`}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Verification */}
        <div className="bg-[#132213] border border-[#2d4a2d] rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#86a886] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#4ade80]" />
              Vérification par échantillon
              {verificationResults && (
                <span className="ml-2 text-xs bg-[#0d250d] text-[#4ade80] px-2 py-0.5 rounded-full">
                  {verOk}/{verTotal} trouvés
                </span>
              )}
            </h2>
            <button
              onClick={runVerification}
              disabled={verifying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f361f] border border-[#2d4a2d]
                         text-xs text-[#86a886] hover:border-[#4ade80] hover:text-[#4ade80] transition-colors
                         disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {verifying ? 'Vérification...' : 'Relancer'}
            </button>
          </div>

          {verifying && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#4ade80]" />
            </div>
          )}

          {verificationResults && !verifying && (
            <div className="space-y-2">
              {verificationResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl text-xs
                    ${r.found ? 'bg-[#0d250d] border border-[#166534]' : 'bg-[#250d0d] border border-[#7f1d1d]'}`}
                >
                  {r.found
                    ? <CheckCircle className="w-4 h-4 text-[#4ade80] flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-[#f87171] flex-shrink-0" />
                  }
                  <span className="text-[#4d6b4d] w-20 flex-shrink-0">
                    {r.type === 'customer' ? 'Client' : 'Commande'}
                  </span>
                  <span className="text-[#86a886] flex-1 truncate">{r.identifier}</span>
                  {r.name && r.name !== r.identifier && (
                    <span className="text-[#4d6b4d] truncate max-w-32">{r.name}</span>
                  )}
                  <span className={`flex-shrink-0 font-semibold ${r.found ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                    {r.found ? '✅' : '❌'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!verificationResults && !verifying && (
            <p className="text-xs text-[#4d6b4d] text-center py-4">
              Cliquez sur "Relancer" pour vérifier des enregistrements aléatoires dans Nocodebackend.
            </p>
          )}
        </div>

        {/* Error summary */}
        {errors.length > 0 && (
          <div className="bg-[#1a0d0d] border border-[#7f1d1d] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-[#f87171] mb-3 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              {formatNumber(errors.length)} erreurs au total
            </h2>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {errors.slice(0, 50).map(err => (
                <div key={err.id} className="text-xs text-[#86a886] py-1 border-b border-[#7f1d1d]/20">
                  <span className="text-[#f87171]">[{err.phase}]</span>{' '}
                  {err.identifier || err.lineNum} — {err.error}
                </div>
              ))}
              {errors.length > 50 && (
                <p className="text-xs text-[#4d6b4d] text-center py-2">
                  … {formatNumber(errors.length - 50)} autres (téléchargez le rapport JSON)
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
