import { useState, useEffect } from 'react';
import { PatientRecord } from './types';
import { getInitialDemoPatients } from './utils/predictor';
import ManualForm from './components/ManualForm';
import BatchProcessor from './components/BatchProcessor';
import AnalyticsCharts from './components/AnalyticsCharts';
import { 
  Heart, 
  Activity, 
  Sparkles, 
  Upload, 
  Database, 
  Search, 
  Trash2, 
  Download, 
  RefreshCw, 
  Clock, 
  ClipboardList, 
  Dna, 
  HeartHandshake,
  Loader2
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'form' | 'batch' | 'records'>('dashboard');
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('All');
  const [selectedModel, setSelectedModel] = useState<'svm' | 'dt' | 'knn' | 'nn'>('svm');
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState('');

  // Re-evaluate all patient records in state when active ML model changes
  const reEvaluateAllRecords = async (model: string) => {
    if (records.length === 0) return;
    setIsGlobalLoading(true);
    setGlobalLoadingMessage('Mengevaluasi ulang seluruh rekam medis dengan model baru...');
    try {
      const cleanedPatients = records.map(({ id, name, age, sex, chestPainType, restingBP, cholesterol, fastingBS, restingECG, maxHR, exerciseAngina, oldpeak, stSlope }) => ({
        id, name, age, sex, chestPainType, restingBP, cholesterol, fastingBS, restingECG, maxHR, exerciseAngina, oldpeak, stSlope
      }));
      const response = await fetch('/api/predict-ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients: cleanedPatients, modelType: model })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal memanggil model Machine Learning.');
      }
      const data = await response.json();
      const mlPredictions = data.predictions;
      
      const predictionError = mlPredictions.find((p: any) => p && p.error);
      if (predictionError) {
        throw new Error(predictionError.error);
      }

      const updated = records.map((item, idx) => {
        const mlPred = mlPredictions[idx];
        if (!mlPred) {
          throw new Error('Hasil prediksi Machine Learning tidak lengkap.');
        }
        return {
          ...item,
          prediction: {
            ...item.prediction!,
            heartDiseaseProbability: mlPred.heartDiseaseProbability,
            riskLevel: mlPred.riskLevel
          }
        };
      });
      updateRecordsState(updated);
    } catch (err: any) {
      console.error('Failed to re-evaluate records with new model:', err);
      alert(`Gagal mengevaluasi ulang data pasien dengan model ${model.toUpperCase()}: ${err.message || err}`);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  // Trigger re-evaluation automatically on model change
  useEffect(() => {
    if (records.length > 0) {
      reEvaluateAllRecords(selectedModel);
    }
  }, [selectedModel]);

  // Load demo patients with ML predictions from backend API
  const loadMlDemoPatients = async (model: string = 'svm') => {
    const defaults = getInitialDemoPatients();
    setIsGlobalLoading(true);
    setGlobalLoadingMessage('Membuat data pasien bawaan dari model ML...');
    try {
      const response = await fetch('/api/predict-ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients: defaults, modelType: model })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal memanggil model Machine Learning.');
      }
      const data = await response.json();
      const mlPredictions = data.predictions;
      
      const predictionError = mlPredictions.find((p: any) => p && p.error);
      if (predictionError) {
        throw new Error(predictionError.error);
      }

      const updated = defaults.map((item, idx) => {
        const mlPred = mlPredictions[idx];
        if (!mlPred) {
          throw new Error('Hasil prediksi Machine Learning tidak lengkap.');
        }
        return {
          ...item,
          prediction: {
            ...item.prediction!,
            heartDiseaseProbability: mlPred.heartDiseaseProbability,
            riskLevel: mlPred.riskLevel
          }
        };
      });
      updateRecordsState(updated);
      return;
    } catch (err: any) {
      console.error('Failed to load demo patients with ML predictions:', err);
      alert(`Gagal memuat pasien bawaan ML: ${err.message || err}`);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  // Load baseline demo records from Kaggle
  useEffect(() => {
    const cached = localStorage.getItem('cardio_workspace_records');
    if (cached) {
      try {
        setRecords(JSON.parse(cached));
      } catch (e) {
        console.error('Failed parsing cached local database, loading demo defaults');
        loadMlDemoPatients(selectedModel);
      }
    } else {
      loadMlDemoPatients(selectedModel);
    }
  }, []);

  // Sync to database cache on changes
  const updateRecordsState = (newRecords: PatientRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem('cardio_workspace_records', JSON.stringify(newRecords));
  };

  const handleAddSingleRecord = (newRec: PatientRecord) => {
    const updated = [newRec, ...records];
    updateRecordsState(updated);
  };

  const handleImportBatch = (newBatch: PatientRecord[]) => {
    const updated = [...newBatch, ...records];
    updateRecordsState(updated);
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus catatan medis kardiak ini?')) {
      const updated = records.filter(rec => rec.id !== id);
      updateRecordsState(updated);
    }
  };

  const handleResetToDemoDefaults = () => {
    if (confirm('Tindakan ini akan menghapus semua data tambahan dan mengembalikan 6 rekam medis pasien bawaan dari dataset Kaggle. Lanjutkan?')) {
      loadMlDemoPatients(selectedModel);
    }
  };

  const handleClearAllHistory = () => {
    if (confirm('Apakah Anda yakin ingin mengosongkan seluruh riwayat database saat ini? Tindakan ini tidak dapat dibatalkan.')) {
      updateRecordsState([]);
    }
  };

  // Convert current patient list with assessments into absolute CSV string for export!
  const handleExportDatabaseCSV = () => {
    if (records.length === 0) {
      alert('Saat ini tidak ada rekam medis di dalam database klinis yang dapat diekspor.');
      return;
    }

    const colHeaders = [
      'Name', 'Age', 'Sex', 'ChestPainType', 'RestingBP', 'Cholesterol', 
      'FastingBS', 'RestingECG', 'MaxHR', 'ExerciseAngina', 'Oldpeak', 
      'ST_Slope', 'HeartDiseaseProbability', 'RiskLevel'
    ];

    const lines = records.map(rec => {
      const prob = rec.prediction?.heartDiseaseProbability ?? 0;
      const rLevel = rec.prediction?.riskLevel ?? 'Low';
      return [
        `"${rec.name.replace(/"/g, '""')}"`,
        rec.age,
        `"${rec.sex}"`,
        `"${rec.chestPainType}"`,
        rec.restingBP,
        rec.cholesterol,
        rec.fastingBS,
        `"${rec.restingECG}"`,
        rec.maxHR,
        `"${rec.exerciseAngina}"`,
        rec.oldpeak,
        `"${rec.stSlope}"`,
        prob,
        `"${rLevel}"`
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [colHeaders.join(','), ...lines].join('\n');
    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodedUri);
    downloadAnchor.setAttribute('download', `rekam_medis_gagal_jantung_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  // Filter and Search mechanism
  const filteredRecords = records.filter(rec => {
    const matchesSearch = rec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          rec.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = riskFilter === 'All' || rec.prediction?.riskLevel === riskFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div id="application-root" className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      
      {/* Upper Professional Hospital Branding Header */}
      <header id="clinical-masthead" className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl text-white shadow-sm shadow-rose-200">
                <Heart className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="font-extrabold text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
                  CardioSphere AI
                  <span className="bg-red-50 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-red-100 font-mono">
                    Klinis v2.4
                  </span>
                </span>
                <p className="text-xs text-slate-550 truncate max-w-[200px] sm:max-w-md">Ruang Kerja Diagnosis Gagal Jantung Berbasis Kecerdasan Buatan</p>
              </div>
            </div>

            {/* Model Selection & Quick Metrics */}
            <div className="flex items-center gap-6 text-xs text-slate-550">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Model ML Aktif:</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="svm">Support Vector Machine (SVM)</option>
                  <option value="dt">Decision Tree</option>
                  <option value="knn">K-Nearest Neighbors (KNN)</option>
                  <option value="nn">Neural Network (MLP)</option>
                </select>
              </div>
              <div className="hidden lg:flex items-center gap-1.5">
                <Dna className="w-4 h-4 text-emerald-500" />
                <span>Status Database: <strong className="font-mono text-slate-700">{records.length} rekam medis</strong></span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Core Platform Content container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="application-workspace">
        
        {/* Banner Section */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-md">
          {/* Subtle medical background vector simulation */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
          
          <div className="max-w-3xl space-y-3 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/12 text-indigo-300 rounded-full text-[10px] font-bold uppercase tracking-wider leading-none">
              <HeartHandshake className="w-3.5 h-3.5" />
              Sesuai dengan Dataset Klinis Kaggle
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              Analisis Prediktif & Diagnostik Gagal Jantung
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl font-medium">
              Evaluasi faktor risiko miokardial menggunakan input stres klinis termasuk ST Segment Slope, Exercise Angina, dan nilai Oldpeak. Lakukan penilaian diagnostik mandiri pasien atau proses ratusan rekam medis kardiak secara instan melalui unggahan spreadsheet standar.
            </p>
          </div>
        </div>

        {/* Tabbed Navigation Workstations */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-2 gap-4" id="navigation-bar">
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('dashboard')}
              id="tab-btn-dashboard"
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-550 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Activity className="w-4 h-4 text-red-500" />
              Ikhtisar & Statistik Analitis
            </button>
            <button
              onClick={() => setActiveTab('form')}
              id="tab-btn-form"
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'form'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-550 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Formulir Diagnostik Manual
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              id="tab-btn-batch"
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'batch'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-550 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Upload className="w-4 h-4 text-indigo-500" />
              Pemroses Data Massal (CSV)
            </button>
            <button
              onClick={() => setActiveTab('records')}
              id="tab-btn-records"
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'records'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-550 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <ClipboardList className="w-4 h-4 text-indigo-500" />
              Riwayat Database Pasien ({records.length})
            </button>
          </nav>

          {/* Core Controls */}
          <div className="flex items-center gap-2 self-start md:self-auto" id="top-tier-controls">
            <button
              type="button"
              id="btn-export-records"
              onClick={handleExportDatabaseCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border border-transparent text-xs font-bold px-3 py-1.8 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Ekspor Database (CSV)
            </button>
            <button
              type="button"
              id="btn-reset-demo"
              onClick={handleResetToDemoDefaults}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-1.8 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              title="Kembalikan Database ke Rekam Medis Demo Bawaan Kaggle"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              Atur Ulang Default
            </button>
          </div>
        </div>

        {/* Tab Workstations Rendering Panels */}
        <div id="workspace-viewport">
          
          {/* Tab Panel: Dashboard Statistics */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6" id="dashboard-workstation-panel">
              <AnalyticsCharts records={records} />
            </div>
          )}

          {/* Tab Panel: Individual Risk Form entry */}
          {activeTab === 'form' && (
            <div id="form-workstation-panel">
              <ManualForm 
                onAddRecord={handleAddSingleRecord} 
                selectedModel={selectedModel} 
                onStartLoading={(msg) => {
                  setGlobalLoadingMessage(msg);
                  setIsGlobalLoading(true);
                }}
                onEndLoading={() => setIsGlobalLoading(false)}
              />
            </div>
          )}

          {/* Tab Panel: Batch File Excel CSV uploader */}
          {activeTab === 'batch' && (
            <div id="batch-workstation-panel">
              <BatchProcessor 
                onImportRecords={handleImportBatch} 
                selectedModel={selectedModel} 
                onStartLoading={(msg) => {
                  setGlobalLoadingMessage(msg);
                  setIsGlobalLoading(true);
                }}
                onEndLoading={() => setIsGlobalLoading(false)}
              />
            </div>
          )}

          {/* Tab Panel: Active Database Search/Filter records list */}
          {activeTab === 'records' && (
            <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm" id="records-workstation-panel">
              <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-500" />
                    Riwayat Diagnostik Rekam Medis Pasien
                  </h2>
                  <p className="text-sm text-slate-500 mt-1 pb-1">
                    Cari, saring, dan tinjau semua berkas rekam medis kardiologi yang dinilai dan tersimpan dalam sesi simulasi ini.
                  </p>
                </div>
                
                {records.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllHistory}
                    id="btn-clear-db"
                    className="self-start md:self-auto text-xs text-red-655 hover:text-red-700 font-bold flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-150 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Kosongkan Semua Riwayat
                  </button>
                )}
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-slate-450 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama pasien..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    id="search-patient-input"
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-semibold"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label htmlFor="risk-filter-dropdown" className="text-xs font-semibold text-slate-550 whitespace-nowrap">Saring Risiko:</label>
                  <select
                    id="risk-filter-dropdown"
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    className="px-3 py-1.8 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-slate-700 font-semibold"
                  >
                    <option value="All">Semua Hasil</option>
                    <option value="Positif Heart Disease">Positif Heart Disease</option>
                    <option value="Negatif Heart Disease">Negatif Heart Disease</option>
                  </select>
                </div>
              </div>

              {/* Table Records List rendering */}
              {filteredRecords.length === 0 ? (
                <div className="text-center p-12 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
                  <p className="text-sm font-bold text-slate-700">Tidak Ada Rekam Medis Pasien yang Cocok</p>
                  <p className="text-xs text-slate-400 mt-1">Coba atur ulang ke default atau periksa kembali filter/kriteria pencarian Anda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="min-w-full divide-y divide-slate-150 text-left text-xs text-slate-650" id="records-table">
                    <thead className="bg-slate-50 font-bold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Nama Pasien</th>
                        <th className="px-3 py-3">Usia/Kelamin</th>
                        <th className="px-3 py-3 text-center">Nyeri Dada</th>
                        <th className="px-3 py-3 text-center">Tanda Vital (TD/Kol)</th>
                        <th className="px-3 py-3 text-center">EKG</th>
                        <th className="px-3 py-3 text-center">ST Slope</th>
                        <th className="px-3 py-3 text-center">Probabilitas</th>
                        <th className="px-3 py-3 text-right">Keputusan</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredRecords.map((rec) => {
                        const prob = rec.prediction?.heartDiseaseProbability ?? 0;
                        let level = rec.prediction?.riskLevel ?? 'Negatif Heart Disease';
                        if (level === 'Low' || level === 'Moderate' || (level as string) === 'Rendah' || (level as string) === 'Sedang') {
                          level = 'Negatif Heart Disease';
                        } else if (level === 'High' || level === 'Critical' || (level as string) === 'Tinggi' || (level as string) === 'Kritis') {
                          level = 'Positif Heart Disease';
                        }
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-850 block">{rec.name}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">{rec.id}</span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {rec.age} th / {rec.sex === 'M' ? 'Pria' : 'Wanita'}
                            </td>
                            <td className="px-3 py-3 text-center font-mono">
                              {rec.chestPainType} ({rec.exerciseAngina === 'Y' ? 'Angina Latihan!' : 'tanpa angina'})
                            </td>
                            <td className="px-3 py-3 text-center">
                              {rec.restingBP} / {rec.cholesterol !== 0 ? `${rec.cholesterol}mg` : 'Tidak Tercatat'}
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              {rec.restingECG} / {rec.maxHR} bpm
                            </td>
                            <td className="px-3 py-3 text-center font-semibold text-slate-700">
                              {rec.stSlope} (op: {rec.oldpeak})
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-slate-800">
                              {prob}%
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                level === 'Positif Heart Disease' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {level}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(rec.id)}
                                className="text-slate-400 hover:text-red-650 transition cursor-pointer"
                                title="Hapus catatan ini"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

      </main>

      {/* Corporate Educational Legal Disclaimer Footer */}
      <footer id="app-disclaimer-footer" className="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-bold text-slate-500">Pernyataan Penyangkalan Klinis & Akademis</p>
          <p className="max-w-3xl mx-auto leading-relaxed">
            CardioSphere AI didesain murni sebagai alat bantu analisis kualitatif dan edukasi klinis berdasarkan dataset publik fedesoriano/heart-failure-prediction di Kaggle. Aplikasi ini tidak menggantikan diagnosis profesional dokter spesialis jantung, pemeriksaan medis langsung, penentuan terapi, atau pemberian resep obat. Pasien wajib berkonsultasi dengan profesional medis kardiologi untuk evaluasi jantung yang akurat.
          </p>
          <p className="pt-4 font-mono text-[10px] text-slate-350">
            © 2026 CardioSphere Healthcare Systems. Semua representasi interpretasi ditenagai oleh Gemini AI dan sistem penilaian diagnostik klinis rule-based.
          </p>
        </div>
      </footer>

      {isGlobalLoading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex flex-col items-center justify-center pointer-events-auto">
          <div className="bg-white p-8 rounded-2xl border border-slate-200/85 shadow-2xl flex flex-col items-center max-w-sm text-center space-y-4">
            <div className="p-3 bg-red-50 rounded-full text-red-500 animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Sedang Memproses</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{globalLoadingMessage || 'Harap tunggu sebentar...'}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
