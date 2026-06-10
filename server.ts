import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  const PORT = 3000;

  // Initialize GoogleGenAI lazy client
  const apiKey = process.env.GEMINI_API_KEY;
  let aiClient: GoogleGenAI | null = null;
  if (apiKey) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', apiKeyConfigured: !!apiKey });
  });

  app.post('/api/predict-ml', (req, res) => {
    const { patient, patients, modelType } = req.body;
    if (!patient && !patients) {
      return res.status(400).json({ error: 'Missing patient or patients data' });
    }

    const activeModel = modelType || 'svm';
    const pythonProcess = spawn('python3', [
      path.join(process.cwd(), 'predict.py'),
      '--model',
      activeModel
    ]);

    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`predict.py exited with code ${code}:`, errorString);
        return res.status(500).json({ error: `Prediction process failed: ${errorString || 'Internal error'}` });
      }

      try {
        const result = JSON.parse(dataString.trim());
        if (result.error) {
          return res.status(500).json({ error: result.error });
        }
        res.json(result);
      } catch (err) {
        console.error('Failed to parse prediction output:', dataString);
        res.status(500).json({ error: 'Failed to parse prediction output' });
      }
    });

    pythonProcess.stdin.write(JSON.stringify({ patient, patients }));
    pythonProcess.stdin.end();
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const { patient, prediction } = req.body;
      if (!patient || !prediction) {
        return res.status(400).json({ error: 'Missing patient or prediction data' });
      }

      if (!aiClient) {
        return res.status(503).json({
          error: 'Kunci API Gemini belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY melalui panel Secrets di Google AI Studio untuk mengaktifkan AI Diagnosis Jantung.'
        });
      }

      const prompt = `Lakukan analisis mendalam terhadap hasil uji stres kardiovaskular pasien dan skor prediksinya berikut ini:
      
      METRIK PASIEN:
      - Usia: ${patient.age} tahun
      - Jenis Kelamin: ${patient.sex === 'M' ? 'Pria' : 'Wanita'}
      - Tipe Nyeri Dada: ${patient.chestPainType} (TA: Angina Tipikal, ATA: Angina Atipikal, NAP: Nyeri Non-Anginal, ASY: Asimtomatik)
      - Tekanan Darah Istirahat: ${patient.restingBP} mm Hg
      - Kolesterol Serum: ${patient.cholesterol} mg/dl (Catatan: 0 menandakan data tidak tercatat/missing dalam dataset klinis Kaggle)
      - Gula Darah Puasa: ${patient.fastingBS === 1 ? '> 120 mg/dl' : '<= 120 mg/dl'}
      - Hasil EKG Istirahat: ${patient.restingECG} (ST: Anomalitas gelombang ST-T, LVH: Hipertrofi Ventrikel Kiri, Normal)
      - Detak Jantung Maksimal (Maks): ${patient.maxHR} bpm
      - Angina Akibat Olahraga/Latihan: ${patient.exerciseAngina === 'Y' ? 'Ada (Ya)' : 'Tidak Ada'}
      - Oldpeak (Depresi ST): ${patient.oldpeak} mm
      - Kemiringan Segmen ST (ST Slope): ${patient.stSlope} (Up: Menanjak, Flat: Datar, Down: Menurun)
      
      LOGIKA PREDIKSI LOKAL:
      - Probabilitas Penyakit Jantung: ${prediction.heartDiseaseProbability}%
      - Tingkat Risiko: ${prediction.riskLevel}

      Berperanlah sebagai Konsultan Kardiologi AI Profesional. Berikan dalam bahasa Indonesia yang sangat jelas, formal, dan klinis:
      1. Penjelasan klinis & fisiologis (clinicalInterpretation) mengapa metrik pasien ini (terutama sinergi berbahaya antara ST Slope, Oldpeak, nyeri dada, dan usia) berkorelasi dengan probabilitas penyakit jantung tersebut berdasarkan pola dataset Kaggle. Sampaikan dengan nada yang otoritatif tetapi mudah dipahami oleh tenaga medis Indonesia maupun pasien. Sertakan penafian medis (medical disclaimer) yang menyatakan bahwa ini adalah referensi edukasi non-klinis dan tidak menggantikan pemeriksaan dokter spesialis jantung.
      2. Set rekomendasi tindakan konkret, pencegahan, atau pemeriksaan skrining lanjut (recommendations) yang spesifik berisi 4 sampai 5 item utama (misalnya pemeriksaan ekokardiografi, MRI jantung, angiografi koroner, modifikasi pola makan DASH, dll). Buat setiap poin penjelasan secara rinci dan mendalam.
      `;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Anda adalah asisten kecerdasan buatan spesialis kardiologi. Anda menganalisis data telemetri klinis pasien berdasarkan pola dataset Kaggle dan mengembalikan laporan JSON terstruktur dalam bahasa Indonesia yang mencakup analisis risiko spesifik serta panduan gaya hidup/skrining medis lanjutan.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              clinicalInterpretation: {
                type: Type.STRING,
                description: 'High-grade, detailed cardiac clinical analysis and explanation of findings.'
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING
                },
                description: 'Array of 4-5 focused cardiac screening, cardiovascular tests, monitoring, or lifestyle directives.'
              }
            },
            required: ['clinicalInterpretation', 'recommendations']
          }
        }
      });

      const textResult = response.text;
      if (!textResult) {
        throw new Error('No response output generated by Gemini');
      }

      const parsed = JSON.parse(textResult.trim());
      res.json(parsed);

    } catch (err: any) {
      console.error('Gemini server analysis error:', err);
      res.status(500).json({ error: err.message || 'An error occurred during Gemini clinical analysis' });
    }
  });

  // Vite Integration as Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
