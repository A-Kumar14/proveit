# ASL Assistant in ProveIt

The ASL Assistant is a sign-to-speech conversation at `/signbridge`. The browser uses ProveIt's same-origin API routes; the Python model service does hand detection and inference locally. Camera frames are handled in memory and are not stored by ProveIt. Existing `signbridge` paths and configuration names are retained internally for compatibility.

The integration combines the attached SignBridge project’s hand-landmark classifier and short-sequence recognition flow with the existing SignBridge-ML adapter. The default local model identifies held ASL fingerspelling letters A–Z. It detects a hand and face, classifies hand landmarks, and shows experimental mouth-opening and brow/eye measurements. Those facial measurements do not identify a person or interpret ASL facial grammar. No-hand and low-score results are rejected rather than added as letters. The alphabet model does not identify motion-based signs or produce sentences on its own.

## Supported local platforms

The default hand/face landmark model is set up for **64-bit Windows 10/11 (x86-64), macOS 13+ (Intel or Apple Silicon), and 64-bit Linux (x86-64)** with Python 3.12. MediaPipe 0.10.21 publishes matching Python 3.12 wheels for those desktop platforms. The model runs locally on the CPU; CUDA is not required. Other processor architectures and mobile operating systems are not covered by this setup.

Each computer that runs ProveIt locally needs its own Python model service and downloaded model assets; the Python service bound to `127.0.0.1` on one person's computer is not shared with another computer. The browser camera API also requires permission and a secure context: use `localhost` on that same computer, or HTTPS if accessing the app remotely.

## Quick local run on macOS/Linux

From the ProveIt repository root, install Python 3.12 and run:

```bash
bash examples/signbridge/setup.sh
.venv-signbridge/bin/python examples/signbridge/check_environment.py
.venv-signbridge/bin/python examples/signbridge/service.py
```

## Quick local run on Windows

Install **64-bit Python 3.12** from [python.org](https://www.python.org/downloads/windows/) and select the Python Launcher option. From the repository root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File examples/signbridge/setup.ps1
& .\.venv-signbridge\Scripts\python.exe .\examples\signbridge\check_environment.py
& .\.venv-signbridge\Scripts\python.exe .\examples\signbridge\service.py
```

In a second terminal on the same computer, install the ProveIt Node dependencies if needed and run `pnpm dev`. Use a Node.js version supported by the ProveIt project (the CI build currently uses Node 24).

The environment check reports the OS and runtime versions, initializes both the hand and face models, and verifies that a blank camera frame is rejected. The GitHub Actions `ASL Assistant platforms` workflow runs this check on Linux, Windows, and macOS.

The downloader stores two assets under `~/.cache/proveit/signbridge/landmark/`, pins the public model repository revision, and verifies each SHA-256 digest before saving:

- `asl_landmark_mlp.pt` — the hand-landmark ASL alphabet classifier.
- `hand_landmarker.task` — MediaPipe's hand detector/landmark model.

The Python service listens on `127.0.0.1:8001`. Leave it running. In a second terminal, with the repository's Node.js dependencies installed, start ProveIt:

```bash
pnpm dev
```

Open [http://localhost:3000/signbridge](http://localhost:3000/signbridge) (or the port printed by Next.js) and allow camera access. The page analyzes camera frames capped at 480 pixels, draws the detected hand and face landmarks, and appends an A–Z letter after four stable frames with a score of at least 75%. Lower-scoring predictions are shown as reviewable suggestions rather than silently transcribed. Temporary service errors use a backoff retry while leaving the camera running. Move your hand between repeated letters, or use **Space**, **Backspace**, and **Clear** to edit the transcript. Choose **Speak recognized letters** for automatic speech or **Speak now** to read the full message.

## Movement recognition

Sentence-level translation is possible with a model trained on continuous ASL video and aligned sentence text, or an explicitly configured vision-language provider with suitable ASL capability. Such a model must learn hand motion, body position, facial grammar, and signer variation; the current A–Z landmark classifier cannot infer sentences by concatenating isolated letters. The page can capture 12 ordered camera frames over about 1.4 seconds. Movement recognition uses either the trained SignBridge-ML sequence model or the optional vision-language provider included in the attached project. The VLM option requires your own provider credentials; without a configured provider, the movement control stays unavailable and no word is guessed. A VLM result is shown as a suggestion and must be explicitly added to the message.

Set the following in the **Python service terminal** before starting `service.py` (Next.js `.env.local` settings alone are not passed to the separate Python process). Select `amd`, `openai`, or `hf`:

```bash
python -m pip install -r examples/signbridge/requirements-motion.txt
export SIGNBRIDGE_PROVIDER=openai
export OPENAI_API_KEY="your-key"
export SIGNBRIDGE_VLM_MODEL_OPENAI="gpt-4o-mini"
```

In PowerShell, set values with `$env:SIGNBRIDGE_PROVIDER = "openai"` and `$env:OPENAI_API_KEY = "your-key"` before launching the service.

For AMD, set `SIGNBRIDGE_PROVIDER=amd`, `AMD_DEV_CLOUD_BASE_URL`, and `AMD_DEV_CLOUD_API_KEY`; the default vision model is `Qwen/Qwen3-VL-32B-Instruct`. For Hugging Face, set `SIGNBRIDGE_PROVIDER=hf` and `HF_TOKEN`; the default is `meta-llama/Llama-3.2-11B-Vision-Instruct`. Use provider terms and billing that you control. Captured frames are sent to that provider only when you explicitly select **Capture movement**.

## Use the full upstream SignBridge-ML pipeline

The commands below follow the upstream project's own environment instructions and are separate from the cross-platform Python 3.12 quick setup above. The upstream dependencies and trained-model runtime are not covered by the `SignBridge platforms` smoke-test workflow.

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
