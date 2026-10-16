# 💰 TabunganKu — Savings Analytics & Dynamic Forecasting

[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](LICENSE)

**TabunganKu — Savings Analytics** adalah aplikasi web pribadi modern untuk mencatat, memantau, dan menganalisis perkembangan tabungan secara konsisten, dilengkapi mesin **Dynamic Forecasting** berbasis realisasi historis, kalender interaktif, simulator skenario, dan grafik analitik interaktif tanpa dependensi eksternal (*zero-dependency*).

---

## ✨ Fitur Utama

### 📊 1. Dashboard Eksekutif Real-Time
- **Status Saldo & Target**: Menampilkan saldo terkini, progres persentase menuju target, dan sisa nominal secara real-time.
- **Indikator Status Jadwal (Pill Badge)**: Menghitung secara otomatis apakah posisi tabungan **Lebih Cepat** (surplus) atau **Tertinggal** (defisit) terhadap rencana.
- **Dual Forecasting Snippet**: Estimasi tanggal tercapai berdasarkan rencana rutin dan berdasarkan tempo riil.
- **Milestone Berikutnya**: Memantau target bertahap terdekat yang harus dicapai.
- **Saving Streak**: Penghitung konsistensi menabung mingguan berturut-turut.

### 🔮 2. Dynamic Forecasting & Evaluasi Deviasi
- **Skenario A (Disiplin Rencana)**: Proyeksi masa depan jika menyetor rutin tepat waktu setiap periode.
- **Skenario B (Realistis Berdasarkan Tempo Riil)**: Proyeksi cerdas dihitung dari rata-rata laju tabungan bersih (*actual net savings velocity*) sejak tanggal awal menabung.
- **Grafik Komparatif**: Membandingkan kurva proyeksi rencana, kurva proyeksi riil, dan garis target tabungan.

### 📅 3. Kalender Finansial Interaktif
- **Visualisasi Bulanan**: Menampilkan tanggal dengan penanda setoran (hijau), penarikan (merah), dan jadwal rutin (outline).
- **Detail Transaksi Saat Tanggal Diklik**: Menampilkan rincian transaksi harian, total arus kas harian, dan tombol cepat **"+ Catat Transaksi di Tanggal Ini"**.
- **Pelacak Target Mingguan**: Memantau pemenuhan target setoran setiap minggunya pada bulan terkait.

### 🧮 4. Simulator Skenario Tabungan
- Menguji coba berbagai target nominal, setoran rutin, frekuensi, tambahan setoran satu kali (*bonus/lump-sum*), maupun rencana penarikan dana.
- Memberikan feedback dampak langsung (misal: mempercepat target tercapai berapa minggu lebih awal).
- Sepenuhnya terisolasi tanpa memengaruhi data tabungan asli.

### 📈 5. Analitik & Evaluasi Arus Kas
- **Target Rencana Kumulatif vs Realisasi Riil**: Grafik perbandingan lintasan rencana terhadap capaian saldo riil.
- **Arus Kas Bulanan**: Grafik batang perbandingan setoran vs penarikan tiap bulan.
- **Statistik & Rasio**: Rata-rata setoran mingguan, rasio simpanan bersih (*saving rate*), dan kategori penarikan terbesar.
- **Financial Insights Otomatis**: Analisis otomatis berbasis pola data pengguna.

### 💾 6. Keamanan & Manajemen Data
- **Penyimpanan Lokal (localStorage)**: Data tersimpan aman di browser pengguna tanpa server pihak ketiga.
- **Backup & Restore JSON**: Cadangkan seluruh data dan pulihkan kapan saja.
- **Ekspor CSV**: Unduh riwayat transaksi dalam format CSV untuk diolah di Microsoft Excel atau Google Sheets.
- **Validasi Keamanan Transaksi**: Mencegah penarikan yang melebihi saldo tabungan dan mencegah transaksi ganda.

---

## 📁 Struktur Direktori

```text
web_menabung/
├── index.html        # Struktur antarmuka utama (SPA) & meta tags SEO
├── style.css         # Desain sistem responsif, dark/light mode & CSS variables
├── script.js         # Engine kalkulasi, forecasting, router hash, dan event handlers
├── favicon.svg       # Ikon situs bertema emerald fintech
├── vercel.json       # Konfigurasi deployment & security headers untuk Vercel
├── package.json      # Metadata proyek & skrip lokal dev
├── .gitignore        # Daftar file yang diabaikan oleh Git
├── LICENSE           # Lisensi Open Source (MIT)
└── README.md         # Dokumentasi proyek
```

---

## 🚀 Panduan Menjalankan Secara Lokal

Aplikasi ini dapat dijalankan dengan dua cara mudah:

### Opsi A: Tanpa Install Apapun (Langsung Buka)
1. Buka folder proyek.
2. Klik ganda file `index.html` untuk langsung membukanya di browser favoritmu (Chrome, Edge, Firefox, Safari).

### Opsi B: Menggunakan Local Server (Direkomendasikan)
Jika Anda memiliki Node.js atau Python terpasang di komputer:

```bash
# Menggunakan npm / npx (Node.js)
npm start

# Atau menggunakan Python
python -m http.server 8080
```
Buka peramban di `http://localhost:8080`.

---

## 🌐 Panduan Push ke GitHub & Deploy ke Vercel

### Langkah 1: Push ke GitHub

1. Buka terminal di folder proyek ini (`web_menabung`).
2. Buat repositori baru di akun [GitHub](https://github.com/new) Anda (misal: `tabunganku`).
3. Jalankan perintah berikut di terminal:

```bash
# Tambahkan seluruh file ke staging git
git add .

# Buat commit pertama
git commit -m "feat: inisialisasi TabunganKu Savings Analytics & Dynamic Forecasting"

# Ubah nama branch utama menjadi main
git branch -M main

# Hubungkan repositori lokal dengan GitHub Anda (ganti URL di bawah sesuai repo Anda)
git remote add origin https://github.com/USERNAME_ANDA/tabunganku.git

# Push kode ke GitHub
git push -u origin main
```

---

### Langkah 2: Deploy ke Vercel

1. Buka [Vercel Dashboard](https://vercel.com/dashboard) dan login menggunakan akun GitHub Anda.
2. Klik tombol **"Add New..."** lalu pilih **"Project"**.
3. Cari repositori **`tabunganku`** yang baru saja Anda push, lalu klik **"Import"**.
4. Pada bagian **Configure Project**:
   - **Framework Preset**: *Other* (sudah otomatis terdeteksi karena ada `vercel.json`).
   - **Root Directory**: `./` (default).
   - **Build and Output Settings**: Biarkan kosong/default (tidak memerlukan build step).
5. Klik **"Deploy"**.
6. Dalam beberapa detik, website TabunganKu Anda akan live dan memiliki URL publik seperti:
   `https://tabunganku.vercel.app` 🎉

---

## 🎨 Teknologi yang Digunakan

- **HTML5**: Struktur semantik modern.
- **Vanilla CSS3**: CSS Grid, Flexbox, CSS Variables, Glassmorphism, Responsive Design.
- **Vanilla JavaScript (ES6+)**: SPA State Management, Native SVG Charting, Zero-dependency.
- **Web Storage API**: `localStorage` untuk persistensi data pengguna.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi [MIT](LICENSE). Silakan gunakan dan kembangkan sesuai kebutuhan Anda.
