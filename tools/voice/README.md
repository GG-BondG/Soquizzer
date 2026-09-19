# Voice clip generator

`make_voice.py` makes the pet's voice clips (`frontend/public/voice/correct-NN.wav` and `wrong-NN.wav`): it reads the lines from
`frontend/src/pet/encouragements.js`, speaks each one with an `edge-tts` voice, then converts the speech to the target
voice with an RVC v2 model (`rvc-python`). Sixteen clips take about a minute on a laptop CPU.

## Setup (once)

Use a separate Python 3.10 environment; the order matters.

```bash
conda create -p ./env python=3.10 -y && conda activate ./env
pip install "pip<24.1"           # rvc-python pins omegaconf 2.0.6, which pip 24.1+ refuses
pip install rvc-python edge-tts
pip install "setuptools<70"      # pyworld imports pkg_resources, which newer setuptools removed
brew install ffmpeg              # or any other way to get ffmpeg on the PATH
```

Download the model files from [Chisato4664/RVC_V2_azuma_seren_seren2](https://huggingface.co/Chisato4664/RVC_V2_azuma_seren_seren2):
`seren2.pth` (57 MB) and `added_IVF1668_Flat_nprobe_1_seren2_v2.index` (205 MB). Use the **added** index. Its README
recommends `trained_*.index`, but `rvc-python` swaps `trained` for `added` in the path itself, and only the added index
holds the voice features. Keep the files outside the repo.

`.pth` files are pickles and can run code when loaded. The `seren2.pth` we used only references plain tensor types
(checked with a read-only scan), and PyTorch loads it in its safe "weights only" mode. Do the same check before using a
different model.

## Run

```bash
python tools/voice/make_voice.py \
  --model /path/to/seren2.pth \
  --index /path/to/added_IVF1668_Flat_nprobe_1_seren2_v2.index \
  --target-f0 330
```

- `--target-f0 330` measures the pitch of the source speech and shifts it to about 330 Hz, the pitch the first (Chinese-language)
  clips had. An English source voice sits around 210 Hz, so it is shifted up 7 semitones. Use `--pitch N` instead to
  set the shift yourself.
- `--only wrong` (or `--only correct`) writes just that kind of clip and leaves the others as they are. The pitch is
  still worked out from all the lines, so new clips match the existing ones. Use it after adding or rewording lines.
- `--voice` picks the `edge-tts` source voice (default `en-US-AriaNeural`; list them with `edge-tts --list-voices`).
- `--index-rate` (default 0.75) is how strongly the model's voice features are mixed in; 0.5 to 0.8 is sensible and
  higher sounds more metallic.

## Things that went wrong once

- **A crash (exit code 139) on macOS** came from rvc-python choosing Apple's MPS backend. The script forces the CPU.
- **`hubert_base.pt` fails to load** on PyTorch 2.6 or newer, because fairseq's `Dictionary` class is not on the safe
  list. The script allows that one class and nothing else; it does not turn off the safe mode.

## Credit and terms

See `frontend/public/voice/README.md`. In short: entertainment and learning only, no commercial use, no impersonation.
