const express = require('express');
const path = require('path');
const { TelegramClient, StringSession } = require('gramjs');
const { Api } = require('gramjs/tl');
const cors = require('cors');

// --- KONFIGURASI ---
// ⚠️ PERINGATAN: API Hash ini tidak aman di sini. Siapa saja bisa lihat.
// Ganti dengan yang baru di my.telegram.org jika sudah pernah diposting.
const API_ID = 27110492;
const API_HASH = "6e1e553fe8088471c9808c373a83c450";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Biar frontend dan backend bisa ngobrol
app.use(express.json()); // Biar bisa baca data JSON dari frontend
app.use(express.static(path.join(__dirname))); // Biar bisa melayani file index.html

// Penyimpanan sementara di memori server. Akan hilang jika server restart.
// Untuk 100 akun, ini cukup efisien.
const tempSessions = new Map();

// --- API ENDPOINTS ---

// Endpoint untuk mengirim kode
app.post('/send-code', async (req, res) => {
    const { nomor } = req.body;
    if (!nomor) return res.status(400).json({ success: false, message: 'Nomor diperlukan' });

    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, API_ID, API_HASH);

    try {
        await client.connect();
        const result = await client.invoke(new Api.auth.SendCode({
            phoneNumber: nomor,
            apiId: API_ID,
            apiHash: API_HASH,
            settings: new Api.CodeSettings({
                allowFlashcall: false,
                currentNumber: false,
                allowAppHash: false,
                allowMissedCall: false,
                logoutTokens: []
            })
        }));

        // Simpan data penting untuk login berikutnya
        tempSessions.set(nomor, {
            sessionString: client.session.save(),
            phoneCodeHash: result.phoneCodeHash,
        });

        console.log(`Kode dikirim ke ${nomor}`);
        res.status(200).json({ success: true, message: `Kode verifikasi telah dikirim ke ${nomor}.` });

    } catch (err) {
        console.error("Gagal mengirim kode:", err);
        res.status(500).json({ success: false, message: `Gagal mengirim kode: ${err.message}` });
    } finally {
        await client.disconnect();
    }
});

// Endpoint untuk login dan menyimpan sesi
app.post('/login-and-save', async (req, res) => {
    const { nomor, code } = req.body;
    if (!nomor || !code) return res.status(400).json({ success: false, message: 'Nomor dan kode diperlukan' });

    const sessionData = tempSessions.get(nomor);
    if (!sessionData) {
        return res.status(400).json({ success: false, message: 'Sesi tidak ditemukan. Silakan minta kode lagi.' });
    }

    const client = new TelegramClient(new StringSession(sessionData.sessionString), API_ID, API_HASH);

    try {
        await client.connect();
        const user = await client.signIn({
            phoneNumber: nomor,
            phoneCode: () => Promise.resolve(code),
            phoneCodeHash: sessionData.phoneCodeHash,
            onError: (err) => console.error(err),
        });

        // Session string yang sudah lengkap, ini adalah "kunci" agar tidak logout
        const finalSessionString = client.session.save();
        
        // Di sini kamu bisa menyimpan finalSessionString ke database atau file.
        // Untuk contoh ini, kita kembalikan ke frontend.
        console.log(`✅ Akun ${user.username || user.firstName} berhasil login!`);

        // Hapus data dari memori setelah berhasil
        tempSessions.delete(nomor);

        res.status(200).json({
            success: true,
            message: `Akun ${nomor} berhasil disimpan!`,
            session: finalSessionString // Kirim session kembali
        });

    } catch (err) {
        console.error("Login gagal:", err);
        res.status(500).json({ success: false, message: `Login gagal: ${err.message}` });
    } finally {
        await client.disconnect();
    }
});

// Route utama untuk melayani file index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Jalankan server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
