import * as Tone from 'tone';

const SCALES = {
    // Sıcak Renkler (Major Pentatonic - Neşeli)
    WARM: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'],
    // Soğuk Renkler (Minor Pentatonic - Derin)
    COOL: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5'],
    // Nötr/Diğer (Ritmik/Perküsif)
    NEUTRAL: ['G3', 'B3', 'D4', 'F#4']
};

class AudioManager {
    constructor() {
        this.synth = null;
        this.drone = null;
        this.filter = null;
        this.isInitialized = false;
        this.lastNoteTime = 0;
    }

    async init() {
        if (this.isInitialized) return;

        await Tone.start();
        console.log('🎵 Audio Context Started');

        // Ana Synth (Polyphonic)
        this.synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: {
                attack: 0.02,
                decay: 0.1,
                sustain: 0.3,
                release: 1
            }
        }).toDestination();

        // Reverb ekle (Uzay boşluğu hissi için)
        const reverb = new Tone.Reverb(2).toDestination();
        this.synth.connect(reverb);

        // Ambiyans (Drone) - KULLANICI İSTEĞİ ÜZERİNE KAPATILDI
        this.filter = new Tone.Filter(200, "lowpass").toDestination();
        // this.drone = new Tone.Oscillator(55, "sawtooth").connect(this.filter); // A1 notası (Deep)
        // this.drone.volume.value = -20; // Başlangıçta kısık
        // this.drone.start();

        this.isInitialized = true;
    }

    playNoteForColor(colorHex) {
        if (!this.isInitialized || !this.synth) return;

        // Performans Limiti: Çok hızlı notaları yut (Cızırtıyı önle)
        const now = Tone.now();
        if (now - this.lastNoteTime < 0.05) return;
        this.lastNoteTime = now;

        const note = this.getNoteFromColor(colorHex);

        // Rastgele velocity (insan dokunuşu hissi)
        const velocity = 0.5 + Math.random() * 0.5;
        this.synth.triggerAttackRelease(note, "8n", now, velocity);
    }

    getNoteFromColor(hex) {
        // Hex'ten RGB'ye (Basit bir yöntem)
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        if (r > g + 50 && r > b + 50) {
            // Kırmızı ağırlıklı -> WARM
            return this.getRandomNote(SCALES.WARM);
        } else if (b > r + 30 || g > r + 30) {
            // Mavi/Yeşil ağırlıklı -> COOL
            return this.getRandomNote(SCALES.COOL);
        } else {
            // Nötr
            return this.getRandomNote(SCALES.NEUTRAL);
        }
    }

    getRandomNote(scale) {
        return scale[Math.floor(Math.random() * scale.length)];
    }

    updateDrone(progress) {
        if (!this.filter || !this.drone) return;

        // Halı doldukça filtre açılır ve ses "parlar"
        // progress: 0.0 -> 1.0
        const minFreq = 200;
        const maxFreq = 2000;
        const currentFreq = minFreq + (maxFreq - minFreq) * progress;

        this.filter.frequency.rampTo(currentFreq, 0.5);

        // Ses seviyesi de hafifçe artar
        const minVol = -25;
        const maxVol = -15;
        this.drone.volume.rampTo(minVol + (maxVol - minVol) * progress, 0.5);
    }

    playFinalCrescendo() {
        if (!this.isInitialized || !this.synth) return;

        // Final Şovu: Tüm notaların yükselişi
        const now = Tone.now();
        const chords = ['C4', 'E4', 'G4', 'B4', 'D5', 'G5'];

        chords.forEach((note, i) => {
            this.synth.triggerAttack(note, now + i * 0.1);
        });

        // Filtreyi sonuna kadar aç
        if (this.filter) {
            this.filter.frequency.rampTo(5000, 2);
        }

        // Drone'u güçlendir
        if (this.drone) {
            this.drone.volume.rampTo(0, 2);
        }
    }

    stopAll() {
        if (this.synth) this.synth.releaseAll();
        if (this.drone) this.drone.volume.rampTo(-60, 1);
        setTimeout(() => {
            if (this.isInitialized) {
                this.updateDrone(0); // Reset drone state
            }
        }, 1000);
    }
}

export const audioManager = new AudioManager();
