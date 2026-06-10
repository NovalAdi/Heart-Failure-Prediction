import { PatientRecord, PredictionResult, BatchAnalysisSummary } from '../types';
import patientsData from '../data/patients.json';

/**
 * Calculates a probabilistic risk score based on the statistical indicators
 * of the fedesoriano/heart-failure-prediction Kaggle dataset.
 */
export function predictHeartDisease(patient: Omit<PatientRecord, 'prediction'>): PredictionResult {
  let score = 15; // Base probability percentage
  const indicators: PredictionResult['indicators'] = [];
  const riskFactors: PredictionResult['riskFactors'] = [];

  // 1. ST Slope (The single strongest visual predictor in the dataset)
  if (patient.stSlope === 'Down') {
    score += 32;
    riskFactors.push({
      factor: 'Kemiringan ST Menurun (Downsloping)',
      impact: 'High',
      description: 'Kemiringan ST menurun merupakan indikator kuat adanya iskemia miokardial berat atau penyempitan arteri koroner.'
    });
    indicators.push({
      name: 'Kemiringan Segmen ST',
      value: 'Menurun (Downsloping)',
      status: 'critical',
      message: 'Menunjukkan kemungkinan tinggi terjadinya iskemia akut atau regangan ventrikel kiri.'
    });
  } else if (patient.stSlope === 'Flat') {
    score += 24;
    riskFactors.push({
      factor: 'Kemiringan ST Datar (Flat)',
      impact: 'High',
      description: 'Kemiringan segmen ST yang datar merupakan indikator diagnostik standar dari stenosis koroner atau iskemia.'
    });
    indicators.push({
      name: 'Kemiringan Segmen ST',
      value: 'Datar (Flat)',
      status: 'warning',
      message: 'Seringkali berkorelasi dengan penyakit arteri koroner dan penurunan cadangan aliran koroner.'
    });
  } else {
    score -= 15;
    indicators.push({
      name: 'Kemiringan Segmen ST',
      value: 'Menanjak (Upsloping)',
      status: 'normal',
      message: 'Biasanya merupakan respons sehat atau normal terhadap tes beban jantung.'
    });
  }

  // 2. Exercise Induced Angina
  if (patient.exerciseAngina === 'Y') {
    score += 22;
    riskFactors.push({
      factor: 'Angina Akibat Aktivitas Fisik',
      impact: 'High',
      description: 'Timbulnya rasa nyeri atau sesak di dada selama aktivitas fisik sangat berkaitan dengan diagnosis aterosklerosis koroner.'
    });
    indicators.push({
      name: 'Angina Akibat Latihan',
      value: 'Ya (Ada)',
      status: 'critical',
      message: 'Rasa nyeri dada saat latihan menegaskan bahwa kebutuhan oksigen otot jantung melebihi pasokan.'
    });
  } else {
    indicators.push({
      name: 'Angina Akibat Latihan',
      value: 'Tidak Ada',
      status: 'normal',
      message: 'Tidak ada nyeri dada abnormal yang dipicu oleh aktivitas fisik.'
    });
  }

  // 3. Chest Pain Type
  if (patient.chestPainType === 'ASY') {
    score += 20;
    riskFactors.push({
      factor: 'Gejala Nyeri Dada Asimtomatik (ASY)',
      impact: 'High',
      description: 'Secara statistik sangat berkaitan dengan penyakit jantung iskemia senyap (silent ischemia) dan keterlambatan pelaporan klinis.'
    });
    indicators.push({
      name: 'Tipe Nyeri Dada',
      value: 'Asimtomatik (ASY)',
      status: 'warning',
      message: 'Pada kelompok berisiko, kurangnya rasa nyeri klasik sering kali menyebabkan penyakit koroner berkembang tanpa disadari.'
    });
  } else if (patient.chestPainType === 'TA') {
    score += 12;
    riskFactors.push({
      factor: 'Angina Tipikal (TA)',
      impact: 'Medium',
      description: 'Nyeri dada jantung klasik yang menjalar, sangat menunjukkan adanya patologi iskemia.'
    });
    indicators.push({
      name: 'Tipe Nyeri Dada',
      value: 'Angina Tipikal (TA)',
      status: 'warning',
      message: 'Rasa tertekan atau sesak klasik yang menunjukkan adanya penyumbatan koroner sementara.'
    });
  } else if (patient.chestPainType === 'NAP') {
    score += 5;
    indicators.push({
      name: 'Tipe Nyeri Dada',
      value: 'Nyeri Non-Anginal (NAP)',
      status: 'normal',
      message: 'Nyeri dada yang kemungkinan besar tidak terkait dengan penyempitan arteri jantung.'
    });
  } else { // ATA
    score += 2;
    indicators.push({
      name: 'Tipe Nyeri Dada',
      value: 'Angina Atipikal (ATA)',
      status: 'normal',
      message: 'Ketidaknyamanan dada yang tidak khas, korelasi klinis minimal.'
    });
  }

  // 4. Oldpeak (ST depression induced by exercise relative to rest)
  if (patient.oldpeak >= 2.0) {
    score += 28;
    riskFactors.push({
      factor: 'Depresi ST Berat (Oldpeak)',
      impact: 'High',
      description: 'Depresi segmen ST sebesar 2.0+ mm menunjukkan hipoksia miokardial yang parah akibat aktivitas fisik.'
    });
    indicators.push({
      name: 'Depresi ST (Oldpeak)',
      value: `${patient.oldpeak} mm`,
      status: 'critical',
      message: 'Depresi ST yang signifikan menunjukkan risiko tinggi penyumbatan arteri koroner multi-pembuluh darah.'
    });
  } else if (patient.oldpeak > 0.8) {
    score += 14;
    riskFactors.push({
      factor: 'Depresi ST Sedang',
      impact: 'Medium',
      description: 'Depresi ST di atas 0.8 mm menunjukkan adanya iskemia subendokardial yang terlihat selama beban kerja jantung.'
    });
    indicators.push({
      name: 'Depresi ST (Oldpeak)',
      value: `${patient.oldpeak} mm`,
      status: 'warning',
      message: 'Depresi ST sedang menunjukkan tanda awal iskemia kardiovaskular.'
    });
  } else {
    indicators.push({
      name: 'Depresi ST (Oldpeak)',
      value: `${patient.oldpeak} mm`,
      status: 'normal',
      message: 'Pemulihan baseline segmen ST yang normal atau nominal.'
    });
  }

  // 5. Sex
  if (patient.sex === 'M') {
    score += 10;
    indicators.push({
      name: 'Faktor Demografi',
      value: 'Pria',
      status: 'normal',
      message: 'Pria secara statistik memiliki onset penyakit kardiovaskular yang lebih awal dalam registrasi global.'
    });
  } else {
    indicators.push({
      name: 'Faktor Demografi',
      value: 'Wanita',
      status: 'normal',
      message: 'Secara statistik memiliki risiko kardiovaskular awal yang lebih rendah, meskipun risiko meningkat setelah menopause.'
    });
  }

  // 6. Age
  if (patient.age > 65) {
    score += 15;
    riskFactors.push({
      factor: 'Profil Jantung Geriatri',
      impact: 'Medium',
      description: 'Usia lanjut (>65 tahun) secara alami berkorelasi dengan kekakuan arteri sistemik dan kalsifikasi koroner.'
    });
  } else if (patient.age > 50) {
    score += 8;
  } else if (patient.age < 40) {
    score -= 8;
  }

  // 7. Max Heart Rate Achieved (MaxHR)
  if (patient.maxHR < 120) {
    score += 16;
    riskFactors.push({
      factor: 'Inkompetensi Kronotropik (MaxHR Rendah)',
      impact: 'Medium',
      description: 'Kegagalan mencapai denyut jantung puncak saat aktivitas stres berhubungan dengan disfungsi otot jantung atau saraf otonom.'
    });
    indicators.push({
      name: 'Detak Jantung Maksimal',
      value: `${patient.maxHR} bpm`,
      status: 'critical',
      message: 'Detak jantung maksimal yang rendah di bawah beban latihan menunjukkan inkompetensi kronotropik.'
    });
  } else if (patient.maxHR < 140) {
    score += 8;
    indicators.push({
      name: 'Detak Jantung Maksimal',
      value: `${patient.maxHR} bpm`,
      status: 'warning',
      message: 'Kapasitas detak jantung nominal di bawah tingkat latihan optimal.'
    });
  } else {
    score -= 5;
    indicators.push({
      name: 'Detak Jantung Maksimal',
      value: `${patient.maxHR} bpm`,
      status: 'normal',
      message: 'Kapasitas akselerasi jantung yang sehat dan responsif.'
    });
  }

  // 8. Resting Blood Pressure (RestingBP)
  if (patient.restingBP >= 160) {
    score += 14;
    riskFactors.push({
      factor: 'Hipertensi Tahap 2',
      impact: 'High',
      description: 'Hipertensi berat (>160 mmHg) secara eksponensial meningkatkan resistensi pembuluh darah dan beban kerja ventrikel kiri.'
    });
    indicators.push({
      name: 'Tekanan Darah Istirahat',
      value: `${patient.restingBP} mmHg`,
      status: 'critical',
      message: 'Hipertensi istirahat berat dapat menyebabkan hipertrofi miokardial dan cedera arteri.'
    });
  } else if (patient.restingBP >= 140) {
    score += 8;
    riskFactors.push({
      factor: 'Hipertensi Tahap 1',
      impact: 'Medium',
      description: 'Tekanan darah konsisten di atas 140 mmHg menyebabkan ketegangan geser endotelial kumulatif.'
    });
    indicators.push({
      name: 'Tekanan Darah Istirahat',
      value: `${patient.restingBP} mmHg`,
      status: 'warning',
      message: 'Tekanan darah tinggi menunjukkan kelebihan beban pembuluh darah yang kronis.'
    });
  } else if (patient.restingBP < 90 && patient.restingBP > 0) {
    indicators.push({
      name: 'Tekanan Darah Istirahat',
      value: `${patient.restingBP} mmHg`,
      status: 'warning',
      message: 'Hipotensi (tekanan darah rendah) dapat mengindikasikan penurunan fungsi pompa otot jantung.'
    });
  } else {
    indicators.push({
      name: 'Tekanan Darah Istirahat',
      value: `${patient.restingBP} mmHg`,
      status: 'normal',
      message: 'Rentang tekanan darah normotensif yang sehat.'
    });
  }

  // 9. Cholesterol and the special Kaggle Zero value
  if (patient.cholesterol === 0) {
    score += 12;
    riskFactors.push({
      factor: 'Kolesterol Tidak Tercatat / Tidak Terdeteksi',
      impact: 'Medium',
      description: 'Kolesterol berkode 0 mewakili data yang hilang pada pencatatan klinis, secara statistik berkerumun dengan kelompok perawatan darurat.'
    });
    indicators.push({
      name: 'Kolesterol Serum',
      value: 'Tidak Tercatat',
      status: 'warning',
      message: 'Tidak ada data dasar kolesterol yang tercatat. Secara statistik berkelompok dengan admisi klinis berisiko tinggi sebelumnya.'
    });
  } else if (patient.cholesterol >= 240) {
    score += 10;
    riskFactors.push({
      factor: 'Hiperkolesterolemia',
      impact: 'Medium',
      description: 'Kolesterol serum di atas 240 mg/dl sangat bersifat aterogenik dan mempercepat pengendapan plak koroner.'
    });
    indicators.push({
      name: 'Kolesterol Serum',
      value: `${patient.cholesterol} mg/dl`,
      status: 'critical',
      message: 'Kolesterol serum yang tinggi meningkatkan aterogenesis kardiovaskular inti.'
    });
  } else if (patient.cholesterol >= 200) {
    score += 5;
    indicators.push({
      name: 'Kolesterol Serum',
      value: `${patient.cholesterol} mg/dl`,
      status: 'warning',
      message: 'Kadar kolesterol sedikit meningkat (ambas batas atas).'
    });
  } else {
    indicators.push({
      name: 'Kolesterol Serum',
      value: `${patient.cholesterol} mg/dl`,
      status: 'normal',
      message: 'Kadar kolesterol dalam batas optimal (di bawah 200 mg/dl).'
    });
  }

  // 10. Fasting Blood Sugar (FastingBS)
  if (patient.fastingBS === 1) {
    score += 12;
    riskFactors.push({
      factor: 'Hiperglisemia / Diabetes Melitus',
      impact: 'Medium',
      description: 'Gula darah puasa yang tinggi melebihi ambang batas metabolik sehat, merusak dinding pembuluh darah serta mikrovaskular koroner.'
    });
    indicators.push({
      name: 'Gula Darah Puasa',
      value: '> 120 mg/dl',
      status: 'warning',
      message: 'Menandakan toleransi glukosa yang buruk atau diabetes aktif, pemicu utama penyakit arteri koroner.'
    });
  } else {
    indicators.push({
      name: 'Gula Darah Puasa',
      value: '≤ 120 mg/dl',
      status: 'normal',
      message: 'Profil glikemik puasa yang sehat.'
    });
  }

  // 11. Resting ECG
  if (patient.restingECG === 'ST') {
    score += 10;
    riskFactors.push({
      factor: 'Profil EKG Gelombang ST-T Abnormal',
      impact: 'Medium',
      description: 'EKG istirahat menunjukkan kelainan gelombang ST-T merupakan prediktor gangguan struktural jantung.'
    });
    indicators.push({
      name: 'EKG Istirahat',
      value: 'Abnormalitas Gelombang ST-T',
      status: 'critical',
      message: 'Abnormalitas listrik jantung saat istirahat menunjukkan potensi hipoksia jantung.'
    });
  } else if (patient.restingECG === 'LVH') {
    score += 12;
    riskFactors.push({
      factor: 'Hipertrofi Ventrikel Kiri (LVH)',
      impact: 'Medium',
      description: 'Dinding bilik jantung kiri menebal yang ditandai oleh LVH menunjukkan beban tekanan kronis atau pembesaran jantung.'
    });
    indicators.push({
      name: 'EKG Istirahat',
      value: 'LVH (Regangan Bilik)',
      status: 'warning',
      message: 'Bukti adanya hipertrofi ventrikel kiri akibat beban kerja jantung tinggi yang kronis.'
    });
  } else {
    indicators.push({
      name: 'EKG Istirahat',
      value: 'Normal',
      status: 'normal',
      message: 'Ritme kelistrikan jantung istirahat yang sehat dan normal.'
    });
  }

  // Cap the final percentage realistically
  const finalProbability = Math.max(2, Math.min(98, score));

  // Determine binary label based on threshold
  const riskLevel: PredictionResult['riskLevel'] = finalProbability >= 50 ? 'Positif Heart Disease' : 'Negatif Heart Disease';

  return {
    heartDiseaseProbability: Math.round(finalProbability),
    riskLevel,
    riskFactors,
    indicators
  };
}

/**
 * Calculates complete distribution and metrics for a batch of patient records.
 */
export function calculateBatchSummary(records: PatientRecord[]): BatchAnalysisSummary {
  const totalCount = records.length;
  if (totalCount === 0) {
    return {
      totalCount: 0,
      diseaseCount: 0,
      normalCount: 0,
      averageAge: 0,
      riskDistribution: { 'Positif Heart Disease': 0, 'Negatif Heart Disease': 0 },
      genderDistribution: { M: 0, F: 0, diseaseM: 0, diseaseF: 0 },
      chestPainDistribution: { TA: 0, ATA: 0, NAP: 0, ASY: 0 },
      stSlopeDistribution: { Up: 0, Flat: 0, Down: 0 }
    };
  }

  let totalAge = 0;
  let diseaseCount = 0;

  const riskDistribution = { 'Positif Heart Disease': 0, 'Negatif Heart Disease': 0 };
  const genderDistribution = { M: 0, F: 0, diseaseM: 0, diseaseF: 0 };
  const chestPainDistribution = { TA: 0, ATA: 0, NAP: 0, ASY: 0 };
  const stSlopeDistribution = { Up: 0, Flat: 0, Down: 0 };

  records.forEach((rec) => {
    totalAge += rec.age;
    
    // Evaluate if record doesn't have prediction yet
    const pred = rec.prediction || predictHeartDisease(rec);
    const hasDisease = pred.heartDiseaseProbability >= 50; // threshold for statistics

    if (hasDisease) {
      diseaseCount++;
    }

    let level = pred.riskLevel as any;
    if (level === 'Low' || level === 'Moderate' || (level as string) === 'Rendah' || (level as string) === 'Sedang') {
      level = 'Negatif Heart Disease';
    } else if (level === 'High' || level === 'Critical' || (level as string) === 'Tinggi' || (level as string) === 'Kritis') {
      level = 'Positif Heart Disease';
    }
    riskDistribution[level]++;
    
    if (rec.sex === 'M') {
      genderDistribution.M++;
      if (hasDisease) genderDistribution.diseaseM++;
    } else {
      genderDistribution.F++;
      if (hasDisease) genderDistribution.diseaseF++;
    }

    chestPainDistribution[rec.chestPainType]++;
    stSlopeDistribution[rec.stSlope]++;
  });

  return {
    totalCount,
    diseaseCount,
    normalCount: totalCount - diseaseCount,
    averageAge: Math.round((totalAge / totalCount) * 10) / 10,
    riskDistribution,
    genderDistribution,
    chestPainDistribution,
    stSlopeDistribution
  };
}

/**
 * Generates initial realistic dummy data modeled directly from the Kaggle dataset.
 * This supplies some patient metrics immediately to populate the dashboard!
 */
export function getInitialDemoPatients(): PatientRecord[] {
  const demoInput = patientsData as Omit<PatientRecord, 'prediction'>[];

  return demoInput.map(item => ({
    ...item,
    prediction: predictHeartDisease(item)
  }));
}
