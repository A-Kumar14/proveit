# ASL Assistant integration

The ASL Assistant service entry point is `examples/signbridge/service.py`. Its default model detects a hand and face, classifies ASL letter landmarks, and rejects missing or uncertain hands instead of classifying arbitrary camera backgrounds. Ordered movement recognition is available through the optional vision provider or a trained upstream SignBridge-ML sequence model.

See [`docs/signbridge.md`](../../docs/signbridge.md) for ASL Assistant setup, supported desktop platforms, the macOS/Linux and Windows setup scripts, the environment check, verified model downloader, optional movement-provider configuration, and commands to run both services.
