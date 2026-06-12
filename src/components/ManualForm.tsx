import React, { useState, useEffect } from 'react';
import { PatientRecord, PredictionResult } from '../types';
import { predictHeartDisease } from '../utils/predictor';
import { ShieldAlert, Heart, Activity, Sliders, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';

interface ManualFormProps {
  onAddRecord: (record: PatientRecord) => void;
  selectedModel: 'svm' | 'dt' | 'knn' | 'nn';
  onStartLoading: (message: string) => void;
  onEndLoading: () => void;
}

export default function ManualForm({ onAddRecord, selectedModel, onStartLoading, onEndLoading }: ManualFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    age: 55,
    sex: 'M' as 'M' | 'F',
    chestPainType: 'ASY' as 'TA' | 'ATA' | 'NAP' | 'ASY',
    restingBP: 130,
    cholesterol: 220,
    fastingBS: 0 as 0 | 1,
    restingECG: 'Normal' as 'Normal' | 'ST' | 'LVH',
    maxHR: 140,
    exerciseAngina: 'N' as 'Y' | 'N',
    oldpeak: 1.0,
    stSlope: 'Flat' as 'Up' | 'Flat' | 'Down',
  });

  const [localPrediction, setLocalPrediction] = useState<PredictionResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<{ clinicalInterpretation: string; recommendations: string[] } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isMlLoading, setIsMlLoading] = useState(false);
  const [mlError, setMlError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let finalValue: string | number = value;

    if (name === 'age' || name === 'restingBP' || name === 'cholesterol' || name === 'maxHR') {
      finalValue = parseInt(value) || 0;
    } else if (name === 'oldpeak') {
      finalValue = parseFloat(value) || 0;
    } else if (name === 'fastingBS') {
      finalValue = parseInt(value) as 0 | 1;
    }

    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  const executeLocalAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsMlLoading(true);
    setMlError(null);
    onStartLoading('Menganalisis parameter klinis dengan model Machine Learning...');
    try {
      const response = await fetch('/api/predict-ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient: formData, modelType: selectedModel })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal memanggil model Machine Learning.');
      }

      const mlResult = await response.json();
      const heuristicResult = predictHeartDisease(formData);
      
      setLocalPrediction({
        ...heuristicResult,
        heartDiseaseProbability: mlResult.heartDiseaseProbability,
        riskLevel: mlResult.riskLevel
      });
      setAiReport(null);
      setAiError(null);
    } catch (err: any) {
      console.error(err);
      setLocalPrediction(null);
      setMlError(err.message || 'Gagal memanggil model Machine Learning.');
    } finally {
      setIsMlLoading(false);
      onEndLoading();
    }
  };

  useEffect(() => {
    if (localPrediction) {
      executeLocalAnalysis();
    }
  }, [selectedModel]);

  const getAiConsultation = async () => {
    if (!localPrediction) return;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: formData,
          prediction: localPrediction
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server diagnostic endpoint returned an error.');
      }

      const data = await response.json();
      setAiReport(data);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Failed to connect to the Gemini server endpoint.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const saveToSystem = () => {
    if (!localPrediction) return;
    const finalRecord: PatientRecord = {
      ...formData,
      id: 'patient-' + Date.now(),
      name: formData.name.trim() || `Pasien #${Math.floor(Math.random() * 9000) + 1000}`,
      prediction: {
        ...localPrediction,
        clinicalInterpretation: aiReport?.clinicalInterpretation,
        recommendations: aiReport?.recommendations,
      }
    };
    onAddRecord(finalRecord);
    
    // Reset or notify
    alert('Catatan rekam medis pasien dengan laporan diagnostik berhasil disimpan!');
    // Keep form as is but reset state
    setLocalPrediction(null);
    setAiReport(null);
    setFormData({
      name: '',
      age: 55,
      sex: 'M',
      chestPainType: 'ASY',
      restingBP: 130,
      cholesterol: 220,
      fastingBS: 0,
      restingECG: 'Normal',
      maxHR: 140,
      exerciseAngina: 'N',
      oldpeak: 1.0,
      stSlope: 'Flat',
    });
  };

  return (
    <div id="manual-form-container" className="flex flex-col gap-8">
      {/* Input Form Column */}
      <form onSubmit={executeLocalAnalysis} id="cardiac-input-form" className="w-full bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-500" />
            Daftar Parameter Kardiovaskular Pasien
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Masukkan pengukuran kuantitatif dan respons angiografis pasien yang dimodelkan langsung dari dataset gagal jantung Kaggle.
          </p>
        </div>

        {/* Section: Basic Demographics */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bagian 1: Profil Umum</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-name">Nama Pasien / Pengenal (Name)</label>
              <input
                id="patient-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Opsional (mis. Ahmad Fadli)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-age">Usia (Tahun) (Age) <span className="text-red-500">*</span></label>
                <input
                  id="patient-age"
                  type="number"
                  name="age"
                  min="20"
                  max="120"
                  required
                  value={formData.age}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-sex">Jenis Kelamin (Sex) <span className="text-red-500">*</span></label>
                <select
                  id="patient-sex"
                  name="sex"
                  value={formData.sex}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
                >
                  <option value="M">Laki-laki (M)</option>
                  <option value="F">Perempuan (F)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Angina Indications */}
        <div className="pt-2 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bagian 2: Indikasi Angina & Nyeri Dada</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-chestpain">Tipe Nyeri Dada (ChestPainType) <span className="text-red-500">*</span></label>
              <select
                id="patient-chestpain"
                name="chestPainType"
                value={formData.chestPainType}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              >
                <option value="ASY">ASY: Asimtomatik (Indikator Risiko Tinggi!)</option>
                <option value="TA">TA: Angina Tipikal (Typical Angina)</option>
                <option value="ATA">ATA: Angina Atipikal (Atypical Angina)</option>
                <option value="NAP">NAP: Nyeri Non-Anginal (Non-Anginal Pain)</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block leading-tight">
                * Catatan: Secara statistik dalam dataset klinis, pasien asimtomatik dengan faktor risiko kardiak menghadapi kompromi kardiovaskular senyap yang tinggi.
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-exang">Angina Latihan (ExerciseAngina) <span className="text-red-500">*</span></label>
              <select
                id="patient-exang"
                name="exerciseAngina"
                value={formData.exerciseAngina}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              >
                <option value="N">Tidak Ada (N)</option>
                <option value="Y">Ya, Dipicu Aktivitas Fisik (Y)</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block leading-tight">
                Menandakan ketidakmampuan arteri koroner beradaptasi sehat terhadap beban latihan fisik.
              </span>
            </div>
          </div>
        </div>

        {/* Section: Physiological Vitals */}
        <div className="pt-2 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bagian 3: Tanda Vital & Profil Darah</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-bp">TD Istirahat (RestingBP) <span className="text-red-500">*</span></label>
              <input
                id="patient-bp"
                type="number"
                name="restingBP"
                min="0"
                max="240"
                required
                value={formData.restingBP}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Normal: ~120 mmHg</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-chol">Kolesterol Serum (Cholesterol) <span className="text-red-500">*</span></label>
              <input
                id="patient-chol"
                type="number"
                name="cholesterol"
                min="0"
                max="600"
                required
                value={formData.cholesterol}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Normal: &lt;200 mg/dl (0: Tidak Tercantum)</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-fbs">Gula Darah Puasa (FastingBS) <span className="text-red-500">*</span></label>
              <select
                id="patient-fbs"
                name="fastingBS"
                value={formData.fastingBS}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              >
                <option value={0}>Normal (≤120 mg/dl)</option>
                <option value={1}>Tinggi / Diabetes (&gt;120 mg/dl)</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">Indikasi tingkat stres glikemik</span>
            </div>
          </div>
        </div>

        {/* Section: Electrocardiogram metrics */}
        <div className="pt-2 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bagian 4: Elektrocardiogram Uji Stres</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-ecg">Hasil EKG Istirahat (RestingECG) <span className="text-red-500">*</span></label>
              <select
                id="patient-ecg"
                name="restingECG"
                value={formData.restingECG}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              >
                <option value="Normal">Normal baseline</option>
                <option value="ST">ST: Abnormalitas gelombang ST-T</option>
                <option value="LVH">LVH: Hipertrofi Ventrikel Kiri</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block leading-tight">
                Mengidentifikasi tanda regangan ventrikel atau iskemia miokard akut.
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-maxhr">Detak Jantung Maksimal (MaxHR) <span className="text-red-500">*</span></label>
              <input
                id="patient-maxhr"
                type="number"
                name="maxHR"
                min="60"
                max="220"
                required
                value={formData.maxHR}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              />
              <span className="text-[11px] text-slate-400 mt-1 block leading-tight font-mono text-right">
                Target sub-maksimal teori: {220 - formData.age} bpm maks
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-oldpeak">Depresi ST (Oldpeak) <span className="text-red-500">*</span></label>
              <input
                id="patient-oldpeak"
                type="number"
                name="oldpeak"
                min="0.0"
                max="10.0"
                step="0.1"
                required
                value={formData.oldpeak}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              />
              <span className="text-[11px] text-slate-400 mt-1 block leading-tight">
                Selisih depresi puncak ST dibanding keadaan istirahat (dalam mm).
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="patient-slope">Kemiringan ST Latihan Puncak (ST_Slope) <span className="text-red-500">*</span></label>
              <select
                id="patient-slope"
                name="stSlope"
                value={formData.stSlope}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              >
                <option value="Up">Up: Menanjak / Upsloping (Risiko Paling Rendah)</option>
                <option value="Flat">Flat: Garis Datar / Flat (Risiko Tinggi)</option>
                <option value="Down">Down: Menurun / Downsloping (Risiko Iskemia Akut)</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block leading-tight font-medium text-amber-600">
                Pola kemiringan ST adalah faktor pemicu penilaian klinis utama kardiologi.
              </span>
            </div>
          </div>
        </div>

        {mlError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2 leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>{mlError}</div>
          </div>
        )}

        <div className="pt-4 flex gap-3">
          <button
            type="submit"
            id="btn-local-analyse"
            disabled={isMlLoading}
            className="flex-1 bg-slate-900 text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-slate-800 transition active:scale-98 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {isMlLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menganalisis dengan ML Model...
              </>
            ) : (
              <>
                <Sliders className="w-4 h-4" />
                Analisis Secara Lokal (ML Model)
              </>
            )}
          </button>
        </div>
      </form>

      {/* Results View Column */}
      <div id="results-display-column" className="w-full space-y-6">
        {!localPrediction ? (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center text-slate-500 flex flex-col items-center justify-center space-y-4">
            <div className="p-3 bg-white rounded-full shadow-sm text-slate-300">
              <Heart className="w-8 h-8 animate-pulse text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 text-base">Menunggu Input Diagnostik</h3>
              <p className="text-sm mt-1 max-w-sm">
                Isi parameter kardiovaskular pasien di sebelah kiri dan klik "Analisis Secara Lokal" untuk memproses algoritma klinis.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Probability summary card */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 overflow-hidden relative">
              <div className={`absolute top-0 left-0 w-2 h-full ${
                localPrediction.riskLevel === 'Positif Heart Disease' ? 'bg-red-500' : 'bg-emerald-500'
              }`}></div>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ringkasan Diagnostik</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold leading-none ${
                  localPrediction.riskLevel === 'Positif Heart Disease'
                    ? 'bg-red-50 text-red-700 border border-red-100'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                }`}>
                  {localPrediction.riskLevel}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-slate-800">{localPrediction.heartDiseaseProbability}%</span>
                <span className="text-sm font-medium text-slate-500">Probabilitas Gagal Jantung</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full mt-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    localPrediction.riskLevel === 'Positif Heart Disease' ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${localPrediction.heartDiseaseProbability}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center text-xs">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-400 block mb-0.5">EKG</span>
                  <span className="font-semibold text-slate-700 block">{formData.restingECG}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-400 block mb-0.5">TD</span>
                  <span className="font-semibold text-slate-700 block">{formData.restingBP}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-400 block mb-0.5 font-mono">ST Slope</span>
                  <span className="font-semibold text-slate-700 block">{formData.stSlope}</span>
                </div>
              </div>
            </div>

            {/* AI Integration consulting trigger */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 hover:from-indigo-50/70 border border-indigo-200/50 p-5 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-500 rounded-xl text-white">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Tingkatkan dengan Gemini Diagnostic Pro</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Hubungkan data klinis ini ke Gemini AI untuk menerjemahkan nilai telemetri mentah menjadi interpretasi kardiologi profesional serta rekomendasi gaya hidup medis.
                  </p>
                </div>
              </div>

              {aiError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-start gap-2 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <div>
                    <span className="font-semibold">Konsultasi AI tidak tersedia:</span> {aiError}
                  </div>
                </div>
              )}

              {aiReport ? (
                <div className="space-y-4 pt-2 border-t border-indigo-100">
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-indigo-50 text-xs text-slate-700 leading-relaxed max-h-[250px] overflow-y-auto">
                    <span className="font-bold text-indigo-900 block mb-1 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                      Interpretasi Klinis Ahli Jantung
                    </span>
                    <p className="whitespace-pre-line">{aiReport.clinicalInterpretation}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-indigo-900 text-xs block mb-1">Rekomendasi Skrining & Gaya Hidup</span>
                    <ul className="space-y-1">
                      {aiReport.recommendations.map((rec, idx) => (
                        <li key={idx} className="bg-white border border-indigo-50 px-3 py-2 rounded-lg text-xs text-slate-700 flex items-start gap-2 shadow-2xs">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-800">
                            {idx + 1}
                          </span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  id="btn-gems-report"
                  disabled={isAiLoading}
                  onClick={getAiConsultation}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 transition active:scale-98 text-white font-semibold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isAiLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menghubungi Ahli Jantung Digital (Gemini AI)...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Dapatkan Laporan Klinis Gemini AI
                    </>
                  )}
                </button>
              )}
            </div>

            {/* List key risk warning factors */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Temuan Faktor Risiko Utama Lokal</h4>
              {localPrediction.riskFactors.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Tidak ada pemicu risiko signifikan yang terdeteksi dalam penyaringan lokal luar.</p>
              ) : (
                <div className="space-y-2">
                  {localPrediction.riskFactors.map((rf, idx) => (
                    <div key={idx} className="flex gap-2.5 p-2 rounded-lg bg-orange-50/50 border border-orange-100/50">
                      <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          {rf.factor}
                          <span className="ml-1.5 px-2 py-0.2 text-[9px] uppercase font-extrabold bg-orange-100 text-orange-850 rounded">
                            Dampak {rf.impact === 'High' ? 'Tinggi' : rf.impact === 'Medium' ? 'Sedang' : 'Rendah'}
                          </span>
                        </span>
                        <p className="text-xs text-slate-650 leading-relaxed mt-0.5">{rf.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action panel to save results */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-slate-800 text-xs font-bold block">Simpan Rekam Medis Ini?</span>
                <span className="text-slate-500 text-[11px] block mt-0.5">Memasukkan analisis kardiologi ini ke dalam riwayat repositori kualitatif lokal.</span>
              </div>
              <button
                type="button"
                id="btn-save-record"
                onClick={saveToSystem}
                className="bg-emerald-600 hover:bg-emerald-700 transition text-white px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                Simpan ke Riwayat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
