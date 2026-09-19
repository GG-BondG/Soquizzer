# Pet voice clips

The pet plays `<id>.wav` from this folder when the student answers correctly, and moves its mouth with the sound.
The ids and the text are in `src/pet/encouragements.js` (`correct-01` ... `correct-08`). A missing clip is fine:
the pet just shows the text.

## How the clips are made

`tools/voice/make_voice.py` speaks each line with a text-to-speech voice and converts that speech to the target voice
with an RVC v2 model. Setup and the exact command are in [`tools/voice/README.md`](../../../tools/voice/README.md).
After changing a line in `encouragements.js`, run it again to regenerate the clips.

## Credit and terms

The voice is an AI voice model of Seren Azuma, not the real artist:
[Chisato4664/RVC_V2_azuma_seren_seren2](https://huggingface.co/Chisato4664/RVC_V2_azuma_seren_seren2), CC-BY-4.0.
Its README states: "For entertainment and learning purposes only. Do not use for commercial purposes, impersonation,
publishing inappropriate content, or other platform policy violations." The voice rights belong to the original artist.
The source speech comes from Microsoft Edge's online text-to-speech voices, through the `edge-tts` package.

So: keep the lines friendly, do not present the voice as the real person, and do not ship it in a commercial product.
