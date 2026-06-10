import { useMemo } from 'react';
import { PatientRecord } from '../types';
import { calculateBatchSummary } from '../utils/predictor';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ShieldAlert, Users, TrendingUp, HeartOff } from 'lucide-react';

interface AnalyticsChartsProps {
  records: PatientRecord[];
}

export default function AnalyticsCharts({ records }: AnalyticsChartsProps) {
  const summary = useMemo(() => calculateBatchSummary(records), [records]);

  // Data mapping for Risk Level Pie Chart
  const riskPieData = useMemo(() => {
    return [
      { name: 'Positif Heart Disease', value: summary.riskDistribution['Positif Heart Disease'], color: '#ef4444' },
      { name: 'Negatif Heart Disease', value: summary.riskDistribution['Negatif Heart Disease'], color: '#10b981' },
    ].filter(item => item.value > 0);
  }, [summary]);

  // Data mapping for Chest Pain presentation types
  const chestPainData = useMemo(() => {
    return [
      { name: 'TA (Typical Angina)', count: summary.chestPainDistribution.TA, label: 'TA' },
      { name: 'ATA (Atypical Angina)', count: summary.chestPainDistribution.ATA, label: 'ATA' },
      { name: 'NAP (Non-Anginal)', count: summary.chestPainDistribution.NAP, label: 'NAP' },
      { name: 'ASY (Asymptomatic)', count: summary.chestPainDistribution.ASY, label: 'ASY' },
    ];
  }, [summary]);

  // Data mapping for ST Slope risk trend
  const slopeData = useMemo(() => {
    return [
      { name: 'Menanjak (Up)', count: summary.stSlopeDistribution.Up, description: 'Up' },
      { name: 'Datar (Flat)', count: summary.stSlopeDistribution.Flat, description: 'Flat' },
      { name: 'Menurun (Down)', count: summary.stSlopeDistribution.Down, description: 'Down' },
    ];
  }, [summary]);

  // Scatter/Bubble simulation plot - mapping Age to MaxHR, colored by risk level
  const scatterSimulationData = useMemo(() => {
    return records.map((rec) => {
      const prob = rec.prediction?.heartDiseaseProbability ?? 0;
      return {
        name: rec.name,
        age: rec.age,
        maxHR: rec.maxHR,
        probability: prob,
        sex: rec.sex,
        risk: rec.prediction?.riskLevel ?? 'Negatif Heart Disease',
        color: prob >= 50 ? '#ef4444' : '#10b981'
      };
    }).sort((a,b) => a.age - b.age);
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-4 shadow-sm">
        <HeartOff className="w-12 h-12 text-slate-350 animate-pulse" />
        <div>
          <h3 className="font-bold text-slate-700 text-lg">Tidak Ada Data Kardiologi Tersedia</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Impor rincian contoh pasien atau gunakan Pemindai Pasien Massal untuk membuat grafik analisis secara otomatis.
          </p>
        </div>
      </div>
    );
  }

  // Calculate clinical rates
  const cardiacInvolvementRate = records.length > 0 
    ? Math.round((summary.diseaseCount / records.length) * 100) 
    : 0;

  return (
    <div id="analytics-grid-workspace" className="space-y-8">
      {/* Dynamic Metric Rows Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-scorecards">
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Pasien Terdaftar</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-800">{summary.totalCount}</span>
            <span className="text-xs text-slate-400 font-medium font-mono">data dimuat</span>
          </div>
          <div className="text-[11px] text-slate-405 mt-1 border-t border-slate-50 pt-2 flex items-center justify-between">
            <span>Pria: {summary.genderDistribution.M}</span>
            <span>Wanita: {summary.genderDistribution.F}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Rataan Usia Pasien</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-800">{summary.averageAge}</span>
            <span className="text-xs text-slate-400 font-medium font-mono">tahun</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 border-t border-slate-50 pt-2">
            Rentang demografi luas berbasis register klinis Kaggle.
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 bg-red-50 rounded-full -z-10 opacity-30"></div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kasus Risiko Tinggi</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-red-650">{summary.diseaseCount}</span>
            <span className="text-xs text-slate-400 font-medium font-mono">(probabilitas &gt; 50%)</span>
          </div>
          <div className="text-[11px] text-red-650 mt-1 border-t border-slate-50 pt-2 flex items-center gap-1 font-semibold text-rose-600">
            <ShieldAlert className="w-3.5 h-3.5" />
            Frekuensi peringatan: {cardiacInvolvementRate}%
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-semibold text-red-600">Kohort Tahap Kritis</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-800">{summary.riskDistribution.Critical}</span>
            <span className="text-xs text-slate-400 font-medium font-mono font-bold text-slate-850">pasien kardiak</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 border-t border-slate-50 pt-2">
            Ditetapkan dalam status prioritas pemantauan klinis segera.
          </div>
        </div>
      </div>

      {/* Main Charts Partition Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="charts-partition-container">
        
        {/* Risk Category Distribution (Pie Chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col h-[320px]">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Segmentasi Risiko Jantung Keseluruhan</h3>
          <p className="text-xs text-slate-400 mb-4">Persentase alokasi pasien berdasarkan kriteria ambang batas risiko ganguan jantung.</p>
          <div className="flex-1 min-h-0 flex items-center justify-between">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value) => [`${value} pasien`, 'Frekuensi']}
                  />
                  <Pie
                    data={riskPieData}
                    cx="50%"
                    cy="48%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {riskPieData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Pie Chart Legend */}
            <div className="w-1/2 space-y-2 pl-4 text-xs">
              {riskPieData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                  <span className="text-slate-700 font-semibold">{item.name}:</span>
                  <span className="text-slate-500 font-mono font-bold ml-auto">{item.value} ({Math.round(item.value / records.length * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chest Pain Presentation Types Frequency */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col h-[320px]">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Distribusi Keluhan Nyeri Dada Angina</h3>
          <p className="text-xs text-slate-400 mb-4">Pengelompokan pasien berdasarkan kategori rasa nyeri dada atau sensasi kardiak.</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chestPainData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Jumlah Pasien">
                  {chestPainData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.label === 'ASY' ? '#be123c' : '#4f46e5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Diagnostic ST Slope Markers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col h-[320px]">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Pembagian Kemiringan Segmen ST EKG</h3>
          <p className="text-xs text-slate-400 mb-4">Sebaran tipe kelandaian segmen ST kardiogram dari beban aktivitas puncak latihan.</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slopeData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Jumlah Pasien">
                  {slopeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.description === 'Up' ? '#10b981' : entry.description === 'Flat' ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hemodynamic Analysis: Age vs Max Heart Rate Trend Area */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col h-[320px]">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Kurva Toleransi Stres Detak Jantung Maksimum</h3>
          <p className="text-xs text-slate-400 mb-4">Perbandingan usia dengan detak jantung puncak yang dicapai. Tren melandai menunjukkan indikasi inkompetensi kronotropik potensial.</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scatterSimulationData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorMaxHR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="age" name="Usia" label={{ value: 'Usia', position: 'insideBottomRight', offset: -5, fontSize: 10 }} tick={{ fontSize: 10 }} />
                <YAxis domain={[60, 210]} label={{ value: 'Detak Jantung Maks', angle: -90, position: 'insideLeft', fontSize: 10 }} tick={{ fontSize: 10 }} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-slate-100 rounded-lg shadow-md text-xs space-y-1">
                          <p className="font-bold text-slate-800">{data.name}</p>
                          <p className="text-slate-600">Usia: <span className="font-semibold">{data.age} tahun</span></p>
                          <p className="text-slate-600">Detak Jantung Puncak: <span className="font-semibold text-rose-600">{data.maxHR} bpm</span></p>
                          <p className="text-indigo-650 font-bold mt-1">Probabilitas gagal jantung: {data.probability}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="maxHR" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorMaxHR)" name="BPM Maksimal" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Analytical Medical Insight Section */}
      <div id="clinical-academic-insights" className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Ringkasan Profil Kardiologi Umum
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-2">
            <p>
              Data klinis statistik penyakit jantung ini memfokuskan interpretasinya pada data angiografi dan stres non-invasif berkelanjutan. Lebih dari <strong>{ summary.diseaseCount } pasien</strong> menunjukkan skor risiko tinggi.
            </p>
            <p>
              Dalam temuan kohort asli dataset Kaggle, tipe kelandaian kardiogram <strong>ST Segment Slope</strong> yang bernilai <span className="text-amber-600 font-semibold">Datar (Flat)</span> dan <span className="text-red-650 font-semibold">Menurun (Downsloping)</span> adalah variabel bersangkutan dengan korelasi terkuat yang menandakan iskemia kronis atau kegagalan sirkulasi ventrikel kiri.
            </p>
          </div>
          <div className="space-y-2">
            <p>
              Penanda klinis penting lainnya dalam kumpulan data ini adalah kondisi <strong>Inkompetensi Kronotropik</strong>, tercermin secara visual melalui frekuensi jantung puncak di bawah ambang batas fisiologis sub-maksimum teoretis ({records.some(r => r.maxHR < 120) ? 'Terdapat indikasi denyut jantung lambat yang terdaftar' : 'Periksa keluaran uji stres untuk memverifikasi'}).
            </p>
            <div className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-700 block">Prevalensi Angina Pasca Latihan</span>
                <span className="text-[11px] text-slate-450 block mt-0.5">Aktivitas fisik sedang yang memicu kemunculan gejala angina kardiak.</span>
              </div>
              <span className="text-lg font-black text-rose-600">
                {records.filter(r => r.exerciseAngina === 'Y').length} Kasus
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
