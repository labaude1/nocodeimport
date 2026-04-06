import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_SECRET_KEY = 'e2871fe4f3d7a7f2af5f58a973db58942ce304633dd001efc281d1164890';
const DEFAULT_INSTANCE = '44716_e_commerce_order_import';
const DEFAULT_API_ROOT = 'https://api.nocodebackend.com';

const initialPhaseStats = () => ({
  total: 0,
  done: 0,
  inserted: 0,
  failed: 0,
  elapsed: 0,
});

const initialProgress = () => ({
  customers: initialPhaseStats(),
  orders: initialPhaseStats(),
  customer_products: initialPhaseStats(),
  totalApiCalls: 0,
  startTime: null,
  elapsed: 0,
  rps: 0,
});

export const useImportStore = create(
  persist(
    (set, get) => ({
      // --- Config ---
      baseUrl: DEFAULT_API_ROOT,
      instanceName: DEFAULT_INSTANCE,
      secretKey: DEFAULT_SECRET_KEY,
      connectionStatus: null, // null | 'testing' | 'ok' | 'error'
      connectionMessage: '',

      // --- Page navigation ---
      currentPage: 'config', // 'config' | 'import' | 'report'

      // --- File ---
      file: null,
      fileName: '',
      fileSize: 0,
      estimatedLines: 0,
      preview: null, // { customers, orders, products, sampleCustomers }

      // --- Import settings ---
      concurrency: 3,
      delay: 100,
      dryRun: false,

      // --- Import state ---
      importStatus: 'idle', // 'idle' | 'parsing' | 'inserting' | 'paused' | 'done' | 'cancelled'
      parseProgress: { bytesRead: 0, totalBytes: 0, linesProcessed: 0, customers: 0, orders: 0, products: 0 },
      progress: initialProgress(),
      currentPhase: null, // 'customers' | 'orders' | 'customer_products'

      // --- Logs ---
      logs: [],
      MAX_LOGS: 200,

      // --- Errors ---
      errors: [],

      // --- Final results ---
      finalResults: null,
      transformedData: null, // { customers, orders, products } for export

      // --- Verification ---
      verificationResults: null,

      // --- Engine ref (not persisted) ---
      engineRef: null,

      // --- Actions ---
      setConfig: (baseUrl, secretKey) => set({ baseUrl, secretKey }),
      setInstanceName: (instanceName) => set({ instanceName }),
      setFullConfig: (apiRoot, instanceName, secretKey) => set({
        baseUrl: apiRoot,
        instanceName,
        secretKey,
      }),

      setConnectionStatus: (status, message = '') =>
        set({ connectionStatus: status, connectionMessage: message }),

      setPage: (page) => set({ currentPage: page }),

      setFile: (file) => {
        if (!file) {
          set({ file: null, fileName: '', fileSize: 0, estimatedLines: 0, preview: null });
          return;
        }
        set({
          file,
          fileName: file.name,
          fileSize: file.size,
          estimatedLines: 0,
          preview: null,
        });
      },

      setEstimatedLines: (n) => set({ estimatedLines: n }),
      setPreview: (preview) => set({ preview }),

      setConcurrency: (n) => set({ concurrency: n }),
      setDelay: (n) => set({ delay: n }),
      setDryRun: (v) => set({ dryRun: v }),

      setImportStatus: (status) => set({ importStatus: status }),
      setCurrentPhase: (phase) => set({ currentPhase: phase }),

      updateParseProgress: (data) =>
        set(state => ({
          parseProgress: { ...state.parseProgress, ...data },
        })),

      initPhase: (tableName, total) =>
        set(state => ({
          progress: {
            ...state.progress,
            [tableName]: { ...initialPhaseStats(), total },
          },
        })),

      updatePhaseProgress: (tableName, data) =>
        set(state => {
          const prev = state.progress[tableName] || initialPhaseStats();
          const totalApiCalls = state.progress.totalApiCalls + (data.done - prev.done);
          return {
            progress: {
              ...state.progress,
              [tableName]: { ...prev, ...data },
              totalApiCalls: Math.max(state.progress.totalApiCalls, totalApiCalls),
              elapsed: state.progress.startTime ? Date.now() - state.progress.startTime : 0,
            },
          };
        }),

      setPhaseComplete: (tableName, data) =>
        set(state => ({
          progress: {
            ...state.progress,
            [tableName]: {
              ...state.progress[tableName],
              inserted: data.inserted,
              failed: data.failed,
              done: data.inserted + data.failed,
            },
          },
        })),

      startTimer: () => set(state => ({
        progress: { ...state.progress, startTime: Date.now() },
      })),

      tickTimer: () => set(state => {
        const elapsed = state.progress.startTime
          ? Date.now() - state.progress.startTime
          : 0;
        const totalDone = Object.values(state.progress).reduce((sum, v) => {
          if (typeof v === 'object' && v.done !== undefined) return sum + v.done;
          return sum;
        }, 0);
        const rps = elapsed > 0 ? (totalDone / (elapsed / 1000)).toFixed(1) : 0;
        return {
          progress: { ...state.progress, elapsed, rps },
        };
      }),

      addLog: (entry) =>
        set(state => {
          const logs = [
            { ...entry, ts: Date.now(), id: Math.random().toString(36).slice(2) },
            ...state.logs,
          ].slice(0, state.MAX_LOGS);
          return { logs };
        }),

      addError: (err) =>
        set(state => ({
          errors: [
            ...state.errors,
            { ...err, ts: Date.now(), id: Math.random().toString(36).slice(2) },
          ],
        })),

      clearErrors: () => set({ errors: [] }),

      setFinalResults: (results) => set({ finalResults: results }),
      setTransformedData: (data) => set({ transformedData: data }),
      setVerificationResults: (results) => set({ verificationResults: results }),
      setEngineRef: (ref) => set({ engineRef: ref }),

      resetImport: () =>
        set({
          importStatus: 'idle',
          parseProgress: { bytesRead: 0, totalBytes: 0, linesProcessed: 0, customers: 0, orders: 0, products: 0 },
          progress: initialProgress(),
          currentPhase: null,
          logs: [],
          errors: [],
          finalResults: null,
          verificationResults: null,
          engineRef: null,
        }),

      resetAll: () =>
        set({
          file: null,
          fileName: '',
          fileSize: 0,
          estimatedLines: 0,
          preview: null,
          importStatus: 'idle',
          parseProgress: { bytesRead: 0, totalBytes: 0, linesProcessed: 0, customers: 0, orders: 0, products: 0 },
          progress: initialProgress(),
          currentPhase: null,
          logs: [],
          errors: [],
          finalResults: null,
          verificationResults: null,
          transformedData: null,
          engineRef: null,
        }),
    }),
    {
      name: 'ncb-import-state',
      // Only persist config and settings, not the file or engine ref
      partialize: (state) => ({
        baseUrl: state.baseUrl,
        instanceName: state.instanceName,
        secretKey: state.secretKey,
        concurrency: state.concurrency,
        delay: state.delay,
        dryRun: state.dryRun,
        fileName: state.fileName,
        fileSize: state.fileSize,
      }),
    }
  )
);
