import express from "express";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram/tl";

const apiId = 27110492;
const apiHash = "6e1e553fe8088471c9808c373a83c450";
const session = new StringSession(""); // kosong dulu

const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
});

const app = express();
app.use(express.json());
app.use(express.static("public"));

let hashStore = {};  // tempat simpan hash OTP kiriman Telegram

// START SERVER
client.start({
    phoneNumber: async () => "",
    password: async () => "",
    phoneCode: async () => "",
    onError: err => console.log(err)
}).then(() => console.log("Telegram Client Ready!"));

// ============= ROUTE KIRIM OTP ====================
app.get("/kirimOTP", async (req, res) => {
    const nomor = req.query.nomor;

    if (!nomor) return res.json({ ok: false, msg: "Nomor kosong" });

    try {
        await client.connect();

        const result = await client.invoke(
            new Api.auth.SendCode({
                phoneNumber: nomor,
                apiId,
                apiHash,
                settings: new Api.CodeSettings({})
            })
        );

        hashStore[nomor] = result.phoneCodeHash;

        return res.json({ ok: true, msg: "Kode OTP terkirim!" });

    } catch (e) {
        return res.json({ ok: false, msg: e.message });
    }
});

// ============= ROUTE CEK KODE ====================
app.post("/verifikasi", async (req, res) => {
    const { nomor, kode } = req.body;

    if (!nomor || !kode)
        return res.json({ ok: false, msg: "Nomor & kode wajib" });

    try {
        await client.connect();

        const login = await client.invoke(
            new Api.auth.SignIn({
                phoneNumber: nomor,
                phoneCode: kode,
                phoneCodeHash: hashStore[nomor]
            })
        );

        return res.json({ ok: true, msg: "Login berhasil", session: client.session.save() });

    } catch (e) {
        return res.json({ ok: false, msg: e.message });
    }
});

// START EXPRESS SERVER
app.listen(3000, () => {
    console.log("Server jalan di http://localhost:3000");
});
