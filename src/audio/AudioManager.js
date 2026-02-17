import * as Tone from 'tone';

// =============================================================================
// 🎵 MÜZİKAL SKALALAR
// =============================================================================
const SCALES = {
    // Sıcak Renkler (Major Pentatonic - Neşeli)
    WARM: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'],
    // Soğuk Renkler (Minor Pentatonic - Derin)
    COOL: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'],
    // Nötr/Diğer (Dorian — Mistik)
    NEUTRAL: ['D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4']
};

// =============================================================================
// 🎶 SES YÖNETİCİSİ — Prosedürel Ses Sistemi
// =============================================================================
class AudioManager {
    constructor() {
        // Synth'ler
        this.synth = null;       // Ana nota synth
        this.flyingSynth = null; // Uçuş notaları
        this.landingSynth = null; // Konma vuruşu
        this.noiseSynth = null;  // Whoosh efekti

        // Ambient müzik
        this.ambientSynth = null;
        this.ambientReverb = null;
        this.ambientDelay = null;
        this.ambientInterval = null;

        // Efektler
        this.reverb = null;

        // Durum
        this.isInitialized = false;
        this.lastNoteTime = 0;
        this.lastFlyingNoteTime = 0;
        this.lastLandingTime = 0;

        // 🔊 Ses kontrol
        this.isMuted = false;
        this.masterVolume = 0.7; // 0-1 arası
    }

    async init() {
        if (this.isInitialized) return;

        await Tone.start();
        console.log('🎵 Audio Context Started');

        // ─── REVERB (Paylaşımlı — Çok derin, katetral) ───
        this.reverb = new Tone.Reverb({ decay: 8, wet: 0.7 }).toDestination();

        // ─── ANA SYNTH (Rüzgar çanı / Kalimba hissi) ───
        this.synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.5, decay: 0.5, sustain: 0.05, release: 3.0 }
        }).toDestination();
        this.synth.connect(this.reverb);
        this.synth.volume.value = -24;

        // ─── UÇUŞ SYNTH (Yumuşak Sine — Rüya Gibi) ───
        this.flyingSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.3,
                decay: 0.4,
                sustain: 0.1,
                release: 1.5
            }
        }).toDestination();
        this.flyingSynth.connect(this.reverb);
        this.flyingSynth.volume.value = -28;

        // ─── KONMA SYNTH (Hafif Tuk — Çok Yumuşak) ───
        this.landingSynth = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 2,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.08 }
        }).toDestination();
        this.landingSynth.volume.value = -28;

        // ─── WHOOSH (Noise + Filter Sweep) ───
        this.noiseSynth = new Tone.NoiseSynth({
            noise: { type: "pink" },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0, release: 0.2 }
        });
        const whooshFilter = new Tone.AutoFilter({
            frequency: "4n",
            baseFrequency: 200,
            octaves: 4
        }).toDestination();
        whooshFilter.start();
        this.noiseSynth.connect(whooshFilter);
        this.noiseSynth.volume.value = -24;

        // ─── JENERATIF AMBIENT MÜZIK (Çok Yumusak, Brian Eno Tarzi) ───
        this.ambientReverb = new Tone.Reverb({ decay: 8, wet: 0.7 }).toDestination();
        this.ambientDelay = new Tone.PingPongDelay({
            delayTime: '4n',
            feedback: 0.3,
            wet: 0.25
        }).connect(this.ambientReverb);

        this.ambientSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: {
                attack: 1.5,   // Çok yavas giriş
                decay: 2,
                sustain: 0.3,
                release: 4     // Uzuuun kuyruk
            }
        }).connect(this.ambientDelay);
        this.ambientSynth.volume.value = -26;

        // Ambient nota havuzu (C major pentatonic — huzurlu)
        this._ambientNotes = [
            'C3', 'E3', 'G3',
            'C4', 'D4', 'E4', 'G4', 'A4',
            'C5', 'E5'
        ];

        // Jeneratif döngü kapatıldı — sadece event-triggered sesler aktif
        // this._startAmbientLoop();

        this.isInitialized = true;
        console.log('🎶 Ses sistemi tam hazır — Ambient + Efektler aktif');
    }

    // ─── RENK NOTALARI (Yumuşak rüzgar çanı) ───
    playNoteForColor(colorHex) {
        if (!this.isInitialized || !this.synth || this.isMuted) return;

        const now = Tone.now();
        if (now - this.lastNoteTime < 0.5) return; // Max 2 nota/sn (sakin, huzurlu)
        this.lastNoteTime = now;

        const note = this.getNoteFromColor(colorHex);
        const velocity = 0.1 + Math.random() * 0.15; // Çok kısık
        this.synth.triggerAttackRelease(note, "4n", now, velocity);
    }

    // ─── UÇUŞ NOTASI ───
    playFlyingNote(colorHex) {
        if (!this.isInitialized || !this.flyingSynth || this.isMuted) return;

        const now = Tone.now();
        if (now - this.lastFlyingNoteTime < 0.15) return;
        this.lastFlyingNoteTime = now;

        const note = this.getNoteFromColor(colorHex);
        const velocity = 0.1 + Math.random() * 0.15;
        this.flyingSynth.triggerAttackRelease(note, '8n', now, velocity);
    }

    // ─── KONMA SESİ (Yumuşak tuk) ───
    playLandingSound() {
        if (!this.isInitialized || !this.landingSynth) return;

        const now = Tone.now();
        if (now - this.lastLandingTime < 0.05) return; // Max 20/sn
        this.lastLandingTime = now;

        // Rastgele pitch varyasyonu (C1-G1 arası)
        const pitches = ['C1', 'D1', 'E1', 'G1'];
        const pitch = pitches[Math.floor(Math.random() * pitches.length)];
        this.landingSynth.triggerAttackRelease(pitch, '32n', now, 0.1 + Math.random() * 0.15);
    }

    // ─── WHOOSH EFEKTİ (Uçuş başlangıcı) ───
    playWhoosh() {
        if (!this.isInitialized || !this.noiseSynth) return;
        this.noiseSynth.triggerAttackRelease("8n");
    }

    // ─── YARDIMCI: Renk → Nota Eşleme (Deterministik) ───
    getNoteFromColor(hex) {
        if (!hex || hex.length < 7) return this.getRandomNote(SCALES.NEUTRAL);

        const r = parseInt(hex.slice(1, 3), 16) || 0;
        const g = parseInt(hex.slice(3, 5), 16) || 0;
        const b = parseInt(hex.slice(5, 7), 16) || 0;

        // Renk skalasını seç
        let scale;
        if (r > g + 50 && r > b + 50) {
            scale = SCALES.WARM;   // Kırmızı/turuncu → neşeli
        } else if (b > r + 30 || (g > r + 30 && g > b)) {
            scale = SCALES.COOL;   // Mavi/yeşil → derin
        } else {
            scale = SCALES.NEUTRAL; // Gri/kahverengi → mistik
        }

        // Parlaklık → nota yüksekliği (deterministic!)
        const brightness = (r + g + b) / 3;
        const index = Math.floor((brightness / 255) * (scale.length - 1));
        return scale[index];
    }

    getRandomNote(scale) {
        return scale[Math.floor(Math.random() * scale.length)];
    }

    // ─── JENERATIF AMBIENT DÖNGÜ ───
    _startAmbientLoop() {
        const playNext = () => {
            if (!this.isInitialized || !this.ambientSynth) return;

            // Rastgele 1 veya 2 nota çal (bazen akor, bazen tek)
            const count = Math.random() > 0.6 ? 2 : 1;
            const notes = [];
            for (let i = 0; i < count; i++) {
                notes.push(this._ambientNotes[
                    Math.floor(Math.random() * this._ambientNotes.length)
                ]);
            }

            const velocity = 0.15 + Math.random() * 0.2; // Çok kısık
            const duration = '2n'; // Uzun nota
            try {
                this.ambientSynth.triggerAttackRelease(notes, duration, undefined, velocity);
            } catch (e) { }

            // Sonraki nota: 3-8 saniye sonra
            const nextDelay = 3000 + Math.random() * 5000;
            this.ambientInterval = setTimeout(playNext, nextDelay);
        };

        // 2 saniye sonra ilk nota
        this.ambientInterval = setTimeout(playNext, 2000);
    }

    // ─── AMBIENT Hız KONTROLÜ ───
    updateDrone(progress) {
        // Halı doldukça ambient daha sık ve biraz daha yüksek çalar
        if (this.ambientSynth) {
            const vol = -28 + progress * 6; // -28 → -22
            this.ambientSynth.volume.rampTo(vol, 1);
        }
    }

    // ─── FİNAL KRESENDO ───
    playFinalCrescendo() {
        if (!this.isInitialized || !this.synth) return;

        const now = Tone.now();
        const chords = ['C4', 'E4', 'G4', 'B4', 'D5', 'G5'];

        chords.forEach((note, i) => {
            this.synth.triggerAttack(note, now + i * 0.1);
        });

        // Ambient'i de crescendo yap
        if (this.ambientSynth) {
            this.ambientSynth.volume.rampTo(-12, 2);
        }
    }

    // ─── DURDUR ───
    stopAll() {
        if (this.synth) this.synth.releaseAll();
        if (this.flyingSynth) this.flyingSynth.releaseAll();
        if (this.ambientSynth) this.ambientSynth.volume.rampTo(-30, 2);
        setTimeout(() => {
            if (this.ambientSynth) this.ambientSynth.volume.rampTo(-26, 3);
        }, 2500);
    }

    // ─── SES SEVİYESİ (0-1) ───
    setVolume(level) {
        this.masterVolume = Math.max(0, Math.min(1, level));
        if (this.isMuted) return;
        const db = level <= 0 ? -Infinity : -30 + level * 30; // 0=-inf, 1=0dB
        Tone.Destination.volume.rampTo(db, 0.1);
    }

    // ─── MUTE/UNMUTE ───
    setMuted(muted) {
        this.isMuted = muted;
        if (muted) {
            Tone.Destination.volume.rampTo(-Infinity, 0.1);
        } else {
            this.setVolume(this.masterVolume);
        }
    }
}

export const audioManager = new AudioManager();
