# SignBridge in ProveIt

SignBridge is a sign-to-speech conversation at `/signbridge`. The browser uses ProveIt's same-origin API routes; the Python model service does hand detection and inference locally. Camera frames are handled in memory and are not stored by ProveIt.

The integration combines the attached SignBridge project’s hand-landmark classifier and short-sequence recognition flow with the existing SignBridge-ML adapter. The default local model identifies held ASL fingerspelling letters A–Z. It detects a hand and face, classifies hand landmarks, and shows experimental mouth-opening and brow/eye measurements. Those facial measurements do not identify a person or interpret ASL facial grammar. No-hand and low-score results are rejected rather than added as letters. The alphabet model does not identify motion-based signs or produce sentences on its own.

## Quick local run

From the ProveIt repository root:

```bash
# Install uv first if needed; MediaPipe 0.10.21 is pinned for macOS 13.
uv python install 3.12
uv venv .venv-signbridge --python 3.12
source .venv-signbridge/bin/activate
python -m pip install -r examples/signbridge/requirements.txt
python examples/signbridge/download_landmark_model.py
python examples/signbridge/service.py
```

The downloader stores two assets under `~/.cache/proveit/signbridge/landmark/`, pins the public model repository revision, and verifies each SHA-256 digest before saving:

- `asl_landmark_mlp.pt` — the SignBridge hand-landmark ASL alphabet classifier.
- `hand_landmarker.task` — MediaPipe's hand detector/landmark model.

The Python service listens on `127.0.0.1:8001`. Leave it running. In a second terminal start ProveIt:

```bash
pnpm dev
```

Open [http://localhost:3000/signbridge](http://localhost:3000/signbridge) (or the port printed by Next.js) and allow camera access. The page analyzes camera frames capped at 480 pixels, draws the detected hand and face landmarks, and appends an A–Z letter after four stable frames with a score of at least 75%. Lower-scoring predictions are shown as reviewable suggestions rather than silently transcribed. Temporary service errors use a backoff retry while leaving the camera running. Move your hand between repeated letters, or use **Space**, **Backspace**, and **Clear** to edit the transcript. Choose **Speak recognized letters** for automatic speech or **Speak now** to read the full message.

## Movement recognition

Sentence-level translation is possible with a model trained on continuous ASL video and aligned sentence text, or an explicitly configured vision-language provider with suitable ASL capability. Such a model must learn hand motion, body position, facial grammar, and signer variation; the current A–Z landmark classifier cannot infer sentences by concatenating isolated letters. The page can capture 12 ordered camera frames over about 1.4 seconds. Movement recognition uses either the trained SignBridge-ML sequence model or the optional vision-language provider included in the attached project. The VLM option requires your own provider credentials; without a configured provider, the movement control stays unavailable and no word is guessed. A VLM result is shown as a suggestion and must be explicitly added to the message.

Set the following in the **Python service terminal** before starting `service.py` (Next.js `.env.local` settings alone are not passed to the separate Python process). Select `amd`, `openai`, or `hf`:

```bash
export SIGNBRIDGE_PROVIDER=openai
export OPENAI_API_KEY="your-key"
export SIGNBRIDGE_VLM_MODEL_OPENAI="gpt-4o-mini"
```

For AMD, set `SIGNBRIDGE_PROVIDER=amd`, `AMD_DEV_CLOUD_BASE_URL`, and `AMD_DEV_CLOUD_API_KEY`; the default vision model is `Qwen/Qwen3-VL-32B-Instruct`. For Hugging Face, set `SIGNBRIDGE_PROVIDER=hf` and `HF_TOKEN`; the default is `meta-llama/Llama-3.2-11B-Vision-Instruct`. Use provider terms and billing that you control. Captured frames are sent to that provider only when you explicitly select **Capture movement**.

## Use the full upstream SignBridge-ML pipeline

The original upstream [SignBridge-ML](https://github.com/asvibes/SignBridge-ML) adapter can recognize its trained static and motion classes locally. Its repository does not bundle trained model weights or datasets, so collect data and train both models following the upstream README first:

```bash
git clone https://github.com/asvibes/SignBridge-ML.git ../SignBridge-ML
cd ../SignBridge-ML
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
# Collect and preprocess static signs, then train the static classifier.
# Collect and preprocess J/Z motion sequences, then train the sequence classifier.
```

Then, from the ProveIt repository root, run the service with the trained checkout selected:

```bash
source ../SignBridge-ML/.venv/bin/activate
export SIGNBRIDGE_ML_PATH="$(cd ../SignBridge-ML && pwd)"
python examples/signbridge/service.py
```

The service prefers the full upstream pipeline when both trained model sets are present; otherwise it uses the hand-landmark alphabet model if downloaded. `SIGNBRIDGE_SERVICE_URL` defaults to `http://127.0.0.1:8001`. `SIGNBRIDGE_HOST` is restricted to a loopback address; `SIGNBRIDGE_PORT` defaults to `8001`.

## Notes

- The previous TinyCNN image-only classifier does not perform hand detection and is rejected by the browser integration.
- The page is inspired by a conversational sign-to-speech flow. It does not animate an avatar signing typed speech; that reverse translation requires a separate sign-language pose-generation model.
- `examples/signbridge/service.py` starts the local Python API. `/health` reports the active model and whether movement recognition is ready. `/predict` handles a held sign; `/motion` handles a short ordered clip; `/reset` clears upstream sequence state.
