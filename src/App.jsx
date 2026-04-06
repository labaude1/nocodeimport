import { Toaster } from 'react-hot-toast';
import { useImportStore } from './stores/importStore';
import ConfigPage from './components/ConfigPage';
import ImportDashboard from './components/ImportDashboard';
import VerificationReport from './components/VerificationReport';

// Navigation indicator
function NavBar() {
  const { currentPage, connectionStatus } = useImportStore();

  const steps = [
    { id: 'config', label: '① Configuration' },
    { id: 'import', label: '② Import' },
    { id: 'report', label: '③ Rapport' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0d1a0d]/90 backdrop-blur-md border-b border-[#1f361f]">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#166534] flex items-center justify-center">
            <span className="text-xs font-bold text-white">N</span>
          </div>
          <span className="text-sm font-semibold text-[#e2f0e2] hidden sm:block">NCB Import</span>
        </div>

        <div className="flex items-center gap-1">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <span className={`text-xs px-3 py-1 rounded-full transition-colors ${
                currentPage === step.id
                  ? 'bg-[#166534] text-white font-semibold'
                  : 'text-[#4d6b4d]'
              }`}>
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <span className="text-[#2d4a2d] mx-1">›</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {connectionStatus === 'ok' && (
            <div className="flex items-center gap-1.5 text-xs text-[#4ade80]">
              <span className="w-1.5 h-1.5 bg-[#4ade80] rounded-full pulse-green" />
              <span className="hidden sm:block">Connecté</span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  const { currentPage } = useImportStore();

  return (
    <div className="min-h-screen bg-[#0d1a0d]">
      <NavBar />

      {/* Main content with top padding for navbar */}
      <div className="pt-12">
        {currentPage === 'config' && <ConfigPage />}
        {currentPage === 'import' && <ImportDashboard />}
        {currentPage === 'report' && <VerificationReport />}
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#132213',
            color: '#e2f0e2',
            border: '1px solid #2d4a2d',
            borderRadius: '12px',
            fontSize: '13px',
          },
          success: {
            iconTheme: { primary: '#4ade80', secondary: '#0d1a0d' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#0d1a0d' },
          },
        }}
      />
    </div>
  );
}
