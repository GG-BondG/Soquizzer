"""Makes the pet's voice clips (frontend/public/voice/correct-XX.wav).

Reads the lines from frontend/src/pet/encouragements.js, speaks each one with a TTS voice, converts that speech to
the target voice with an RVC v2 model, and writes one wav file per line id. See tools/voice/README.md for setup.

    python make_voice.py --model seren2.pth --index added_IVF1668_Flat_nprobe_1_seren2_v2.index --target-f0 330
"""
import argparse
import math
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

# faiss and torch each bring an OpenMP runtime on macOS, and loading both can crash the process.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")

ROOT = Path(__file__).resolve().parents[2]
LINES_FILE = ROOT / "frontend" / "src" / "pet" / "encouragements.js"


def read_lines():
    """[(id, text)] from encouragements.js. Texts are in single or double quotes."""
    pattern = r"id: '(correct-\d+)', text: (?:\"([^\"]+)\"|'([^']+)')"
    return [(line_id, double or single) for line_id, double, single in re.findall(pattern, LINES_FILE.read_text(encoding="utf-8"))]


def speak(text, voice, wav_path, work_dir):
    """Plain text-to-speech (Microsoft Edge's online voices through the edge-tts package), saved as a wav."""
    mp3_path = work_dir / (wav_path.stem + ".mp3")
    # A tilde is only decoration for the speech bubble; it should not be read out.
    spoken = text.replace("~", "")
    subprocess.run(
        [sys.executable, "-m", "edge_tts", "--voice", voice, "--text", spoken, "--write-media", str(mp3_path)],
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3_path), "-ar", "44100", "-ac", "1", str(wav_path)],
        check=True,
    )


def pitch_shift_to(target_hz, wav_paths):
    """Whole semitones that move the median pitch of the source clips to target_hz."""
    import librosa
    import numpy as np

    pitches = []
    for path in wav_paths:
        audio, rate = librosa.load(str(path), sr=16000)
        f0, _, _ = librosa.pyin(audio, fmin=80, fmax=600, sr=rate)
        pitches.extend(f0[~np.isnan(f0)])
    median = float(np.median(pitches))
    shift = max(-12, min(12, round(12 * math.log2(target_hz / median))))
    print(f"source median pitch {median:.0f} Hz, target {target_hz:.0f} Hz -> shift {shift:+d} semitones", flush=True)
    return shift


def load_converter(model, index, pitch, index_rate):
    import torch
    from fairseq.data.dictionary import Dictionary

    # rvc-python picks Apple's MPS backend on its own, which crashed here; CPU is slower but reliable.
    torch.backends.mps.is_available = lambda: False
    # hubert_base.pt is a fairseq checkpoint. PyTorch >= 2.6 loads files in "weights only" mode, which refuses this
    # one plain data class. It is the only class allowed, so the checkpoint still cannot run arbitrary code.
    torch.serialization.add_safe_globals([Dictionary])

    from rvc_python.infer import RVCInference

    rvc = RVCInference(device="cpu:0", model_path=str(model), index_path=str(index), version="v2")
    rvc.set_params(f0method="rmvpe", f0up_key=pitch, index_rate=index_rate, protect=0.33)
    return rvc


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", required=True, type=Path, help="RVC v2 .pth file")
    parser.add_argument("--index", required=True, type=Path, help="the added_*.index file (not trained_*)")
    parser.add_argument("--out", type=Path, default=ROOT / "frontend" / "public" / "voice")
    parser.add_argument("--voice", default="en-US-AriaNeural", help="edge-tts voice used as the source speech")
    parser.add_argument("--pitch", type=int, default=0, help="semitones to shift the source by")
    parser.add_argument(
        "--target-f0",
        type=float,
        help="median pitch in Hz to aim for; works out the shift from the source speech and overrides --pitch",
    )
    parser.add_argument("--index-rate", type=float, default=0.75, help="0.5 to 0.8 is sensible; higher is more metallic")
    args = parser.parse_args()

    lines = read_lines()
    if not lines:
        sys.exit(f"No lines found in {LINES_FILE}")
    args.out.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        for line_id, text in lines:
            speak(text, args.voice, work / f"{line_id}.wav", work)
        pitch = pitch_shift_to(args.target_f0, [work / f"{i}.wav" for i, _ in lines]) if args.target_f0 else args.pitch
        rvc = load_converter(args.model, args.index, pitch, args.index_rate)
        for line_id, _ in lines:
            rvc.infer_file(str(work / f"{line_id}.wav"), str(args.out / f"{line_id}.wav"))
            print("wrote", args.out / f"{line_id}.wav", flush=True)


if __name__ == "__main__":
    main()
