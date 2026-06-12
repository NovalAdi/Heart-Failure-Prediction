import React, { useState, useRef, useEffect } from 'react';
import { PatientRecord } from '../types';
import { predictHeartDisease } from '../utils/predictor';
import { Upload, FileText, CheckCircle2, ChevronLeft, ChevronRight, AlertCircle, Info, Database } from 'lucide-react';

interface BatchProcessorProps {
  onImportRecords: (records: PatientRecord[]) => void;
  selectedModel: 'svm' | 'dt' | 'knn' | 'nn';
  onStartLoading: (message: string) => void;
  onEndLoading: () => void;
}

export default function BatchProcessor({ onImportRecords, selectedModel, onStartLoading, onEndLoading }: BatchProcessorProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parsedRecords, setParsedRecords] = useState<PatientRecord[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const parseCsvText = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentValue = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Double quote inside quotes is an escaped quote
          currentValue += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentValue.trim());
        currentValue = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip the \n
        }
        row.push(currentValue.trim());
        if (row.length > 1 || row[0] !== '') {
          lines.push(row);
        }
        row = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    if (row.length > 0 || currentValue !== '') {
      row.push(currentValue.trim());
      lines.push(row);
    }

    return lines;
  };

  const processFile = (file: File) => {
    setErrorMsg(null);
    setFileName(file.name);

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setErrorMsg('Saat ini, hanya ekspor file CSV dan teks premium yang didukung. Untuk file Excel, harap simpan atau ekspor sebagai file .csv terlebih dahulu.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      onStartLoading('Mengekstrak dan memproses berkas spreadsheet CSV...');
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error('Konten data kosong.');

        const rawMatrix = parseCsvText(text);
        if (rawMatrix.length < 2) {
          throw new Error('Spreadsheet membutuhkan setidaknya 1 baris header dan 1 baris data pasien.');
        }

        const headers = rawMatrix[0].map(h => h.replace(/["\r]/g, '').trim().toLowerCase());
        
        // Find positions for schema mappings
        const findIndex = (labels: string[]): number => {
          return headers.findIndex(h => {
            const cleanHeader = h.replace(/[-_]/g, '');
            return labels.some(lbl => cleanHeader.includes(lbl) || lbl.includes(cleanHeader));
          });
        };

        const ageIdx = findIndex(['age', 'umur']);
        const sexIdx = findIndex(['sex', 'gender', 'jenis', 'kelamin']);
        const cpIdx = findIndex(['chestpain', 'cp', 'nyeridada']);
        const bpIdx = findIndex(['restingbp', 'trestbps', 'bloodpressure', 'tekanandarah']);
        const cholIdx = findIndex(['cholesterol', 'chol', 'kolesterol']);
        const fbsIdx = findIndex(['fastingbs', 'fbs', 'guladarah']);
        const ecgIdx = findIndex(['restingecg', 'restecg', 'ecg', 'ekg']);
        const hrIdx = findIndex(['maxhr', 'thalach', 'heartrate', 'detakjantung']);
        const exangIdx = findIndex(['exerciseangina', 'exang', 'angina']);
        const oldpeakIdx = findIndex(['oldpeak', 'depresist']);
        const slopeIdx = findIndex(['slope', 'stslope', 'kemiringan']);
        const nameIdx = findIndex(['name', 'id', 'nama', 'patient']);

        // Require at least age, sex, and one cardiac parameter
        if (ageIdx === -1 || sexIdx === -1) {
          throw new Error('Tidak dapat menentukan tajuk kolom Usia dan Jenis Kelamin secara otomatis. Pastikan kolom spreadsheet sesuai dengan nama asli dataset Gagal Jantung Kaggle.');
        }

        const patientInputs: Omit<PatientRecord, 'prediction'>[] = [];

        for (let idx = 1; idx < rawMatrix.length; idx++) {
          const row = rawMatrix[idx];
          if (row.length < headers.length - 2) continue; // Skip incomplete or trailing lines

          const getVal = (colIdx: number, fallback: string): string => {
            if (colIdx === -1 || colIdx >= row.length) return fallback;
            return row[colIdx];
          };

          const rawSex = getVal(sexIdx, 'M').toUpperCase();
          const cleanSex = (rawSex.startsWith('F') || rawSex === '0' || rawSex === 'FEMALE') ? 'F' : 'M';

          const rawCp = getVal(cpIdx, 'ASY').toUpperCase();
          let cleanCp: 'TA' | 'ATA' | 'NAP' | 'ASY' = 'ASY';
          if (rawCp.includes('TA') || rawCp === 'TYPICAL') cleanCp = 'TA';
          else if (rawCp.includes('ATA') || rawCp === 'ATYPICAL') cleanCp = 'ATA';
          else if (rawCp.includes('NAP') || rawCp.includes('NON')) cleanCp = 'NAP';

          const rawBP = parseInt(getVal(bpIdx, '125')) || 125;
          const rawChol = parseInt(getVal(cholIdx, '210')) || 0; // support Kaggle 0
          const rawFbs = getVal(fbsIdx, '0');
          const cleanFbs: 0 | 1 = (rawFbs === '1' || rawFbs.toUpperCase() === 'Y' || rawFbs.toUpperCase() === 'YES' || rawFbs.toUpperCase() === 'TRUE') ? 1 : 0;

          const rawEcg = getVal(ecgIdx, 'Normal').toUpperCase();
          let cleanEcg: 'Normal' | 'ST' | 'LVH' = 'Normal';
          if (rawEcg.includes('ST')) cleanEcg = 'ST';
          else if (rawEcg.includes('LVH') || rawEcg.includes('HYPER')) cleanEcg = 'LVH';

          const rawMaxHr = parseInt(getVal(hrIdx, '138')) || 138;
          
          const rawExang = getVal(exangIdx, 'N').toUpperCase();
          const cleanExang: 'Y' | 'N' = (rawExang.startsWith('Y') || rawExang === '1' || rawExang === 'YES' || rawExang === 'TRUE') ? 'Y' : 'N';
          
          const rawOldpeak = parseFloat(getVal(oldpeakIdx, '1.0')) || 0.0;

          const rawSlope = getVal(slopeIdx, 'Flat').toUpperCase();
          let cleanSlope: 'Up' | 'Flat' | 'Down' = 'Flat';
          if (rawSlope.includes('UP')) cleanSlope = 'Up';
          else if (rawSlope.includes('DOWN')) cleanSlope = 'Down';

          const patientName = getVal(nameIdx, `Garis Rekaman #${idx}`);

          const recordInput: Omit<PatientRecord, 'prediction'> = {
            id: `imported-${Date.now()}-${idx}`,
            name: patientName,
            age: parseInt(getVal(ageIdx, '55')) || 55,
            sex: cleanSex,
            chestPainType: cleanCp,
            restingBP: rawBP,
            cholesterol: rawChol,
            fastingBS: cleanFbs,
            restingECG: cleanEcg,
            maxHR: rawMaxHr,
            exerciseAngina: cleanExang,
            oldpeak: rawOldpeak,
            stSlope: cleanSlope
          };

          patientInputs.push(recordInput);
        }

        if (patientInputs.length === 0) {
          throw new Error('Tidak ada data tabel valid yang berhasil diisolasi dari spreadsheet ini.');
        }

        // Call the batch ML API
        const apiResponse = await fetch('/api/predict-ml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patients: patientInputs, modelType: selectedModel })
        });

        if (!apiResponse.ok) {
          const errorData = await apiResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Gagal menganalisis batch data menggunakan model Machine Learning.');
        }

        const data = await apiResponse.json();
        const mlPredictions = data.predictions;

        const predictionError = mlPredictions.find((p: any) => p && p.error);
        if (predictionError) {
          throw new Error(predictionError.error);
        }

        const newlyParsed: PatientRecord[] = patientInputs.map((recordInput, idx) => {
          const mlPred = mlPredictions[idx];
          if (!mlPred) {
            throw new Error('Hasil prediksi Machine Learning tidak lengkap.');
          }
          const heuristicResult = predictHeartDisease(recordInput);
          return {
            ...recordInput,
            prediction: {
              ...heuristicResult,
              heartDiseaseProbability: mlPred.heartDiseaseProbability,
              riskLevel: mlPred.riskLevel
            }
          };
        });

        setParsedRecords(newlyParsed);
        setCurrentPage(1);

      } catch (err: any) {
        console.error(err);
        setParsedRecords([]);
        setErrorMsg(err.message || 'Terjadi kesalahan saat memuat/mengekstrak elemen data.');
      } finally {
        onEndLoading();
      }
    };
    reader.readAsText(file);
  };

  const reEvaluateParsedRecords = async (model: 'svm' | 'dt' | 'knn' | 'nn') => {
    if (parsedRecords.length === 0) return;
    onStartLoading('Mengevaluasi ulang pratinjau rekam medis CSV dengan model baru...');
    setErrorMsg(null);
    try {
      const cleanedPatients = parsedRecords.map(({ id, name, age, sex, chestPainType, restingBP, cholesterol, fastingBS, restingECG, maxHR, exerciseAngina, oldpeak, stSlope }) => ({
        id, name, age, sex, chestPainType, restingBP, cholesterol, fastingBS, restingECG, maxHR, exerciseAngina, oldpeak, stSlope
      }));
      const response = await fetch('/api/predict-ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients: cleanedPatients, modelType: model })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal mengevaluasi ulang data pasien.');
      }
      const data = await response.json();
      const mlPredictions = data.predictions;
      
      const predictionError = mlPredictions.find((p: any) => p && p.error);
      if (predictionError) {
        throw new Error(predictionError.error);
      }

      const updated = parsedRecords.map((item, idx) => {
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
      setParsedRecords(updated);
    } catch (err: any) {
      console.error('Failed to re-evaluate parsed batch records:', err);
      setErrorMsg(err.message || 'Gagal mengevaluasi ulang data pasien.');
      setParsedRecords([]);
    } finally {
      onEndLoading();
    }
  };

  useEffect(() => {
    reEvaluateParsedRecords(selectedModel);
  }, [selectedModel]);

  const clearImport = () => {
    setParsedRecords([]);
    setFileName(null);
    setErrorMsg(null);
    setCurrentPage(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportClick = () => {
    if (parsedRecords.length === 0) return;
    onImportRecords(parsedRecords);
    alert(`Berhasil mengimpor ${parsedRecords.length} rekam medis ke dalam ruang kerja kardiologi.`);
    clearImport();
  };

  // Pagination bounds
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = parsedRecords.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(parsedRecords.length / recordsPerPage);

  // Generate demographic presets for the user to try instantly!
  const downloadKaggleTemplate = () => {
    const csvContent = 
"Age,Sex,ChestPainType,RestingBP,Cholesterol,FastingBS,RestingECG,MaxHR,ExerciseAngina,Oldpeak,ST_Slope,Name\n" +
"40,M,ATA,140,289,0,Normal,172,N,0.0,Up,Ahmad Fadli\n" +
"49,F,NAP,160,180,0,Normal,156,N,1.0,Flat,Budi Raharjo\n" +
"37,M,ATA,130,283,0,ST,98,N,0.0,Up,Cassandra\n" +
"48,F,ASY,138,214,0,Normal,108,Y,1.5,Flat,Deni Saputra\n" +
"54,M,NAP,150,195,0,Normal,122,N,0.0,Up,Eka Wijaya\n" +
"39,M,ASY,120,339,0,Normal,170,N,0.0,Up,Fahmi Yusuf\n" +
"45,F,ATA,130,237,0,Normal,170,N,0.0,Up,Gina Amelia\n" +
"54,M,ASY,110,208,0,Normal,142,N,0.0,Up,Heri Setiawan\n" +
"37,M,ASY,140,207,0,Normal,130,Y,1.5,Flat,Indra Lesmana\n" +
"48,F,ASY,120,284,0,Normal,120,N,0.0,Up,Julia Roberts\n" +
"58,M,ASY,136,164,0,ST,99,Y,2.0,Flat,Kevin Cooper\n" +
"39,M,ATA,120,204,0,Normal,145,N,0.0,Up,Lina Marlina\n" +
"58,M,ASY,144,213,0,LVH,113,Y,2.0,Flat,Muhammad Rizki";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "templat_kaggle_gagal_jantung.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="batch-processor-container" className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
      <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-500" />
            Pemindai Pasien Massal (Spreadsheet CSV)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Analisis ratusan baris data kardiovaskular sekaligus. Sistem kami mencocokkan tajuk kolom secara otomatis dengan format Kaggle.
          </p>
        </div>

        <button
          type="button"
          id="btn-get-template"
          onClick={downloadKaggleTemplate}
          className="self-start md:self-auto bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
        >
          <FileText className="w-4 h-4 text-indigo-500" />
          Unduh Sampel Templat CSV
        </button>
      </div>

      {/* File Upload Stage Area */}
      {parsedRecords.length === 0 ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          id="dropzone-file-upload"
          className={`border-2 border-dashed rounded-xl p-8 text-center transition flex flex-col items-center justify-center space-y-4 ${
            dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <input
            id="csv-file-input"
            ref={fileInputRef}
            type="file"
            accept=".csv, .txt"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="p-4 bg-indigo-50 rounded-full text-indigo-500">
            <Upload className="w-8 h-8 animate-bounce" />
          </div>
          <div>
            <p className="text-slate-700 font-bold text-sm">Seret dan taruh file klinis Anda di sini</p>
            <p className="text-xs text-slate-400 mt-1">Menerima ekspor file standar CSV terstruktur (dipisahkan koma atau titik koma)</p>
          </div>
          <button
            type="button"
            id="btn-trigger-upload"
            onClick={() => fileInputRef.current?.click()}
            className="bg-indigo-600 hover:bg-indigo-700 transition text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
          >
            Pilih File Klinis
          </button>
        </div>
      ) : (
        <div id="file-info-header" className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-lg text-white">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm block">File klinis berhasil diproses</span>
              <span className="text-slate-500 text-xs block mt-0.5">{fileName} — berisi {parsedRecords.length} data rekam medis</span>
            </div>
          </div>
          <button
            type="button"
            id="btn-remove-parsed"
            onClick={clearImport}
            className="text-xs text-slate-500 hover:text-red-500 font-semibold cursor-pointer"
          >
            Hapus Data
          </button>
        </div>
      )}

      {errorMsg && (
        <div id="upload-error-banner" className="pt-2">
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3 text-red-655 text-xs inline-flex w-full leading-relaxed">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
            <div>
              <span className="font-bold text-red-800">Kesalahan Pemrosesan Kardiologi:</span> {errorMsg}
            </div>
          </div>
        </div>
      )}

      {/* Grid preview under parse */}
      {parsedRecords.length > 0 && (
        <div id="parsed-records-grid" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pratinjau Diagnostik Pasien</h3>
            <span className="text-xs font-medium text-slate-500">Menampilkan {indexOfFirstRecord + 1} - {Math.min(indexOfLastRecord, parsedRecords.length)} dari {parsedRecords.length} data pasien</span>
          </div>

          <div className="overflow-x-auto border border-slate-150 rounded-xl">
            <table className="min-w-full divide-y divide-slate-150 text-left text-xs text-slate-650">
              <thead className="bg-slate-50 font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Nama Pasien</th>
                  <th className="px-3 py-3">Usia/Kelamin</th>
                  <th className="px-3 py-3 text-center">Nyeri Dada</th>
                  <th className="px-3 py-3 text-center">Tanda Vital (TD/Kol)</th>
                  <th className="px-3 py-3 text-center">EKG</th>
                  <th className="px-3 py-3 text-center">ST Slope</th>
                  <th className="px-3 py-3 text-center">Probabilitas</th>
                  <th className="px-4 py-3 text-right">Keputusan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {currentRecords.map((rec) => {
                  const prob = rec.prediction?.heartDiseaseProbability ?? 0;
                   const level = rec.prediction?.riskLevel ?? 'Negatif Heart Disease';
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-semibold text-slate-850 whitespace-nowrap">{rec.name}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{rec.age} th / {rec.sex === 'M' ? 'Pria' : 'Wanita'}</td>
                      <td className="px-3 py-3 text-center font-mono">{rec.chestPainType} ({rec.exerciseAngina === 'Y' ? 'Angina Latihan!' : 'tanpa angina'})</td>
                      <td className="px-3 py-3 text-center">{rec.restingBP} / {rec.cholesterol !== 0 ? `${rec.cholesterol}mg` : 'Tidak Tercatat'}</td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">{rec.restingECG} / {rec.maxHR} bpm</td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-700">{rec.stSlope} (op: {rec.oldpeak})</td>
                      <td className="px-3 py-3 text-center font-bold text-slate-800">{prob}%</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          level === 'Positif Heart Disease' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {level}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div id="grid-pagination" className="flex items-center justify-between pt-2">
              <button
                type="button"
                id="btn-page-prev"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 px-2.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Sebelumnya
              </button>

              <span className="text-xs text-slate-500 font-medium font-mono">Halaman {currentPage} dari {totalPages}</span>

              <button
                type="button"
                id="btn-page-next"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1 px-2.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 transition flex items-center gap-1 cursor-pointer"
              >
                Berikutnya
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Import to primary statistics button */}
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <Info className="w-4.5 h-4.5 text-indigo-650 mt-0.5 shrink-0" />
              <p className="text-xs text-indigo-900 leading-relaxed">
                Mengimpor baris data ini akan memasukkannya ke dalam database pusat kardiologi aktif secara instan. Ini akan langsung memperbarui grafik demografis, histogram risiko, dan diagram sebar analisis.
              </p>
            </div>
            <button
              type="button"
              id="btn-confirm-import"
              onClick={handleImportClick}
              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 transition active:scale-98 text-white font-bold text-xs py-2 px-6 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Database className="w-4 h-4" />
              Impor {parsedRecords.length} Baris Data ke Pipeline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
