# Pet voice clips

The pet plays `<id>.wav` from this folder when the student answers correctly, and moves its mouth with the sound.
The ids and the text are in `src/pet/encouragements.js` (`correct-01` ... `correct-08`). A missing clip is fine:
the pet just shows the text.

## Making the clips

1. Record or synthesise each line from `encouragements.js` as plain speech (for example with a TTS voice).
2. Convert it with the RVC v2 voice model, using `seren2.pth` and `trained_IVF1668_Flat_nprobe_1_seren2_v2.index`.
3. Save the result as `<id>.wav` here, for example `correct-01.wav`. Short clips (1 to 4 seconds) are best.

Only load RVC model files (`.pth` is a pickle file and can run code) from sources you trust.

## Credit and terms

The voice is an AI voice model of 東雪蓮 (Seren Azuma), not the real artist:
[Chisato4664/RVC_V2_azuma_seren_seren2](https://huggingface.co/Chisato4664/RVC_V2_azuma_seren_seren2), CC-BY-4.0.
Its README states: "For entertainment and learning purposes only. Do not use for commercial purposes, impersonation,
publishing inappropriate content, or other platform policy violations." The voice rights belong to the original artist.

So: keep the lines friendly, do not present the voice as the real person, and do not ship it in a commercial product.
