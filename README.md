# CardioSphere AI — Sistem Prediksi Gagal Jantung Multi-Model

Proyek ini merupakan **Aplikasi Web Asisten Klinis Prediksi Gagal Jantung** yang dibangun menggunakan teknologi modern React, Node.js/Express, dan Python. Sistem ini mengintegrasikan **4 model machine learning (SVM, Decision Tree, KNN, dan Neural Network)** yang dilatih menggunakan dataset klinis gagal jantung dari Kaggle untuk memprediksi probabilitas gangguan kardiovaskular secara real-time.

> [!NOTE]
> Proyek ini diajukan untuk memenuhi persyaratan **Tugas Besar** pada mata kuliah **Dasar Ilmu Data**.

---

## 🌟 Fitur Utama

1. **Dashboard & Analisis Statistik Interaktif**:
   * Visualisasi segmentasi risiko kardiologi pasien.
   * Grafik demografi gender & usia pasien yang terintegrasi.
   * Grafik sebar (*scatter plot*) korelasi detak jantung maksimal (Max HR) dengan usia.
   * Histogram visualisasi kemiringan segmen ST (*ST Slope*).

2. **Dukungan Multi-Model Machine Learning**:
   * Dapat memilih model aktif secara global di pojok kanan atas:
     * **Support Vector Machine (SVM)** (`heartf_svm.sav`)
     * **Decision Tree** (`heartf_dt.sav`)
     * **K-Nearest Neighbors (KNN)** (`heartf_knn.sav`)
     * **Neural Network (MLP)** (`heartf_nn.sav`)
   * **Real-time Re-evaluation**: Mengubah pilihan model pada dropdown otomatis menghitung ulang dan memperbarui status seluruh data rekam medis di state/riwayat secara instan.

3. **Formulir Input Pasien Kardiovaskular**:
   * Pengisian mandiri parameter klinis (usia, jenis kelamin, tipe nyeri dada, tekanan darah, kolesterol, gula darah, EKG, detak jantung, angina latihan, oldpeak, kemiringan ST).
   * Layout vertikal yang rapi dan mudah dibaca guna melihat hasil diagnosis secara langsung.

4. **Pemindaian Pasien Massal (Spreadsheet CSV)**:
   * Mengunggah file CSV berukuran besar berisi rekam medis pasien.
   * Melakukan pencocokan header kolom secara pintar (*auto-mapping*).
   * Melakukan prediksi secara massal dalam satu waktu melalui backend API berkecepatan tinggi.

5. **Integrasi Gemini Diagnostic Pro**:
   * Menghubungkan metrik klinis kualitatif pasien dengan Gemini AI untuk menerjemahkan nilai telemetri mentah menjadi interpretasi kardiologi profesional serta rekomendasi gaya hidup medis terstruktur.

6. **Premium User Experience (UX)**:
   * Dilengkapi dengan *Global Loading Screen Overlay* berbasis glassmorphism untuk memblokir interaksi sementara saat proses komputasi Machine Learning sedang berlangsung.

---

## 🛠️ Arsitektur & Teknologi

* **Frontend**: React (TypeScript), TailwindCSS (Styling), Lucide React (Icons), Recharts (Visualisasi Data).
* **Backend API Server**: Node.js dengan Express, memproses request dan meneruskannya ke engine Python.
* **ML Engine & Models**: Python 3 (Scikit-Learn, Joblib, Pandas, Numpy) yang dipanggil secara asinkron lewat Express `child_process`.
* **LLM Integration**: Google GenAI SDK (Gemini 3.5 Flash) untuk asisten interpretasi kardiologi klinis.

---

## 🚀 Cara Menjalankan Aplikasi

### Prasyarat
Pastikan Anda sudah menginstal:
* [Node.js](https://nodejs.org/) (versi 18+)
* [Python 3](https://www.python.org/) dengan library: `pandas`, `numpy`, `joblib`, `scikit-learn`

### 1. Instalasi Dependensi Node.js
Buka terminal di root direktori proyek, lalu jalankan:
```bash
npm install
```

### 2. Instalasi Dependensi Python
Pastikan library machine learning sudah terpasang di Python Anda:
```bash
pip3 install pandas numpy joblib scikit-learn
```

### 3. Konfigurasi Kunci API Gemini (Opsional)
Untuk mengaktifkan asisten interpretasi kardiologi Gemini AI, buat file bernama `.env` di root direktori proyek dan tambahkan kunci API Anda:
```env
GEMINI_API_KEY=KUNCI_API_GEMINI_ANDA
```
*Jika tidak ditambahkan, aplikasi akan tetap berfungsi normal pada bagian prediksi Machine Learning lokal.*

### 4. Menjalankan Server Pengembangan
Jalankan perintah berikut di terminal:
```bash
npm run dev
```
Buka browser dan buka alamat: **`http://localhost:3000`**

---

## 📊 Penggunaan Fitur

### Pemilihan Model Aktif
* Di pojok kanan atas layar header (Masthead), gunakan dropdown **Model ML Aktif** untuk mengganti model kardiologi yang sedang berjalan (SVM, DT, KNN, atau Neural Network). Seluruh data riwayat pasien dan grafik dashboard akan berubah menyesuaikan tingkat keyakinan model tersebut secara instan.

### Mengisi Formulir Manual
1. Navigasikan ke tab **Formulir Diagnosis**.
2. Masukkan nama pasien dan nilai metrik klinis kardiovaskular.
3. Klik tombol **Analisis Secara Lokal (ML Model)**.
4. Hasil persentase probabilitas, status risiko, dan tombol integrasi Gemini AI akan muncul di bagian bawah formulir.
5. Klik **Simpan ke Riwayat** untuk menyimpannya ke database visual lokal.

### Impor Data CSV Massal
1. Navigasikan ke tab **Pemindai CSV**.
2. Anda dapat mengeklik **Unduh Sampel Templat CSV** untuk melihat format kolom yang dibutuhkan.
3. Seret file CSV Anda atau klik **Pilih File Klinis**.
4. Data pasien akan otomatis terpetakan dan menampilkan prediksi probabilitas serta keputusan awal di tabel pratinjau.
5. Klik **Impor Baris Data ke Pipeline** untuk memasukkan seluruh data tersebut ke database statistik utama dashboard.

---

## 📝 Catatan Proyek
Proyek ini dikembangkan menggunakan dataset **Heart Failure Prediction** yang memuat 11 fitur penting kardiologi. Model latih (.sav) disimpan di dalam direktori `models/` proyek.
* `heartf_svm.sav`
* `heartf_dt.sav`
* `heartf_knn.sav`
* `heartf_nn.sav`
* `scaler_heartf.sav`