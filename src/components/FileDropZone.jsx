import { useState, useRef } from 'react';
import { Upload, FileText, X, BarChart2, Users, ShoppingCart, Package } from 'lucide-react';
import { useImportStore } from '../stores/importStore';
import { estimateLineCount, previewJsonlFile } from '../lib/jsonlParser';
import { transformOrder } from '../lib/dataTransformer';
import { upsertCustomer, getCustomerList } from '../lib/customerDeduplicator';
import { formatFileSize, formatNumber } from '../lib/utils';
import toast from 'react-hot-toast';

export default function FileDropZone() {
  const { file, fileName, fileSize, estimatedLines, preview, setFile, setEstimatedLines, setPreview } = useImportStore();
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setPreview(null);
    // Estimate line count
    estimateLineCount(f).then(n => setEstimatedLines(n));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    toast.loading('Analyse des 100 premières lignes...', { id: 'analyze' });

    try {
      const sample = await previewJsonlFile(file, 100);
      const custMap = new Map();
      let orderCount = 0;
      let productCount = 0;

      for (const raw of sample) {
        try {
          const { customerData, orderData, productItems } = transformOrder(raw);
          if (customerData.email) upsertCustomer(custMap, customerData);
          orderCount++;
          productCount += productItems.length;
        } catch (e) { /* skip */ }
      }

      const customers = getCustomerList(custMap);
      setPreview({
        uniqueCustomers: customers.length,
        orders: orderCount,
        products: productCount,
        sampleCustomers: customers.slice(0, 5).map(c => ({
          name: `${c.first_name} ${c.last_name}`.trim() || '(sans nom)',
          email: c.email,
        })),
      });
      toast.success('Analyse terminée !', { id: 'analyze' });
    } catch (e) {
      toast.error('Erreur lors de l\'analyse : ' + e.message, { id: 'analyze' });
    }
    setAnalyzing(false);
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onClick={() => !file && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${dragging ? 'border-[#4ade80] bg-[#1a2e1a]' : file ? 'border-[#2d4a2d] bg-[#0d1a0d]' : 'border-[#2d4a2d] bg-[#0d1a0d] hover:border-[#3a5c3a] hover:bg-[#132213]'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,.jsonl,.txt,.json.txt"
          className="hidden"
          onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
        />

        {file ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#166534] border border-[#22c55e] flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-[#4ade80]" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-[#e2f0e2] font-medium text-sm truncate">{fileName}</p>
              <p className="text-[#86a886] text-xs mt-0.5">
                {formatFileSize(fileSize)}
                {estimatedLines > 0 && (
                  <span className="ml-2 text-[#4d6b4d]">
                    ≈ {formatNumber(estimatedLines)} lignes estimées
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
              className="p-1.5 rounded-lg hover:bg-[#1a2e1a] text-[#4d6b4d] hover:text-[#f87171] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
            <div className="w-14 h-14 rounded-2xl bg-[#1f361f] border border-[#2d4a2d] flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 text-[#4ade80]" />
            </div>
            <p className="text-[#e2f0e2] font-medium mb-1">Déposez votre fichier JSONL ici</p>
            <p className="text-[#86a886] text-sm mb-3">ou cliquez pour sélectionner</p>
            <p className="text-[#4d6b4d] text-xs">.json · .jsonl · .json.txt — jusqu'à 2 GB</p>
          </div>
        )}
      </div>

      {/* Analyze button */}
      {file && !preview && (
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                     bg-[#1f361f] border border-[#2d4a2d] text-[#86a886] text-sm font-medium
                     hover:border-[#4ade80] hover:text-[#4ade80] disabled:opacity-50
                     transition-all duration-200"
        >
          <BarChart2 className={`w-4 h-4 ${analyzing ? 'animate-pulse' : ''}`} />
          {analyzing ? 'Analyse en cours...' : 'Analyser le fichier (100 premières lignes)'}
        </button>
      )}

      {/* Preview results */}
      {preview && (
        <div className="bg-[#0d1a0d] border border-[#2d4a2d] rounded-xl p-4 animate-fade-in">
          <h4 className="text-sm font-semibold text-[#86a886] mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#4ade80]" />
            Aperçu (100 premières lignes)
          </h4>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#132213] rounded-lg p-3 text-center">
              <Users className="w-4 h-4 text-[#4ade80] mx-auto mb-1" />
              <p className="text-xl font-bold text-[#e2f0e2] font-mono-num">{formatNumber(preview.uniqueCustomers)}</p>
              <p className="text-xs text-[#4d6b4d]">clients uniques</p>
            </div>
            <div className="bg-[#132213] rounded-lg p-3 text-center">
              <ShoppingCart className="w-4 h-4 text-[#4ade80] mx-auto mb-1" />
              <p className="text-xl font-bold text-[#e2f0e2] font-mono-num">{formatNumber(preview.orders)}</p>
              <p className="text-xs text-[#4d6b4d]">commandes</p>
            </div>
            <div className="bg-[#132213] rounded-lg p-3 text-center">
              <Package className="w-4 h-4 text-[#4ade80] mx-auto mb-1" />
              <p className="text-xl font-bold text-[#e2f0e2] font-mono-num">{formatNumber(preview.products)}</p>
              <p className="text-xs text-[#4d6b4d]">produits</p>
            </div>
          </div>

          {preview.sampleCustomers && preview.sampleCustomers.length > 0 && (
            <div>
              <p className="text-xs text-[#4d6b4d] mb-2">Clients échantillon :</p>
              <div className="space-y-1">
                {preview.sampleCustomers.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-5 h-5 rounded-full bg-[#1f361f] border border-[#2d4a2d] flex items-center justify-center text-[#4ade80] font-bold text-xs flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-[#e2f0e2] font-medium">{c.name}</span>
                    <span className="text-[#4d6b4d]">·</span>
                    <span className="text-[#86a886] truncate">{c.email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
