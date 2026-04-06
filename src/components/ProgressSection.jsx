import { Users, ShoppingCart, Package, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatNumber, formatDuration, estimateRemaining } from '../lib/utils';

const TABLE_CONFIG = {
  customers: { label: 'Clients', icon: Users, color: '#4ade80' },
  orders: { label: 'Commandes', icon: ShoppingCart, color: '#60a5fa' },
  customer_products: { label: 'Produits', icon: Package, color: '#fbbf24' },
};

function PhaseProgress({ tableName, stats, isActive }) {
  const config = TABLE_CONFIG[tableName] || { label: tableName, icon: Package, color: '#4ade80' };
  const Icon = config.icon;
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const remaining = stats.total > 0 && stats.done > 0 && stats.elapsed > 0
    ? estimateRemaining(stats.done, stats.total, stats.elapsed)
    : null;

  return (
    <div className={`bg-[#0d1a0d] border rounded-xl p-4 transition-all duration-300
      ${isActive ? 'border-[' + config.color + '] shadow-lg' : 'border-[#1f361f]'}`}
      style={isActive ? { borderColor: config.color + '66', boxShadow: `0 0 20px ${config.color}10` } : {}}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: config.color + '20', border: `1px solid ${config.color}40` }}>
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e2f0e2]">{config.label}</p>
            {isActive && (
              <div className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: config.color }} />
                <span className="text-xs" style={{ color: config.color }}>En cours</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold text-[#e2f0e2] font-mono-num">{pct}%</p>
          <p className="text-xs text-[#4d6b4d]">
            {formatNumber(stats.done)} / {formatNumber(stats.total)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[#1f361f] rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: config.color,
            backgroundImage: isActive
              ? `linear-gradient(90deg, ${config.color}88, ${config.color}, ${config.color}88)`
              : 'none',
            backgroundSize: '200px 100%',
            animation: isActive ? 'progress-shine 1.5s infinite linear' : 'none',
          }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[#4ade80]">
            <CheckCircle className="w-3 h-3" />
            {formatNumber(stats.inserted)} insérés
          </span>
          {stats.failed > 0 && (
            <span className="flex items-center gap-1 text-[#f87171]">
              <XCircle className="w-3 h-3" />
              {formatNumber(stats.failed)} échecs
            </span>
          )}
        </div>
        {remaining !== null && remaining > 0 && isActive && (
          <span className="flex items-center gap-1 text-[#4d6b4d]">
            <Clock className="w-3 h-3" />
            ~{formatDuration(remaining)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ProgressSection({ progress, currentPhase, importStatus }) {
  const totalDone = (progress.customers?.done || 0) + (progress.orders?.done || 0) + (progress.customer_products?.done || 0);
  const totalTotal = (progress.customers?.total || 0) + (progress.orders?.total || 0) + (progress.customer_products?.total || 0);
  const totalPct = totalTotal > 0 ? Math.round((totalDone / totalTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Overall stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-[#0d1a0d] border border-[#1f361f] rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-[#4ade80] font-mono-num">{formatNumber(progress.totalApiCalls || 0)}</p>
          <p className="text-xs text-[#4d6b4d] mt-0.5">Appels API effectués</p>
        </div>
        <div className="bg-[#0d1a0d] border border-[#1f361f] rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-[#60a5fa] font-mono-num">{formatNumber(Math.max(0, totalTotal - totalDone))}</p>
          <p className="text-xs text-[#4d6b4d] mt-0.5">Restants</p>
        </div>
        <div className="bg-[#0d1a0d] border border-[#1f361f] rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-[#e2f0e2] font-mono-num">{formatDuration(progress.elapsed || 0)}</p>
          <p className="text-xs text-[#4d6b4d] mt-0.5">Temps écoulé</p>
        </div>
        <div className="bg-[#0d1a0d] border border-[#1f361f] rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-[#fbbf24] font-mono-num">{progress.rps || 0}</p>
          <p className="text-xs text-[#4d6b4d] mt-0.5">Req/s</p>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="bg-[#0d1a0d] border border-[#1f361f] rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-[#86a886]">Progression globale</span>
          <span className="text-sm font-bold text-[#e2f0e2]">{totalPct}%</span>
        </div>
        <div className="h-3 bg-[#1f361f] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${totalPct}%`,
              background: 'linear-gradient(90deg, #166534, #4ade80)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-[#4d6b4d]">{formatNumber(totalDone)} enregistrements traités</span>
          <span className="text-xs text-[#4d6b4d]">{formatNumber(totalTotal)} total</span>
        </div>
      </div>

      {/* Per-table progress */}
      {['customers', 'orders', 'customer_products'].map(table => (
        <PhaseProgress
          key={table}
          tableName={table}
          stats={progress[table] || { total: 0, done: 0, inserted: 0, failed: 0, elapsed: 0 }}
          isActive={currentPhase === table && (importStatus === 'inserting')}
        />
      ))}
    </div>
  );
}
