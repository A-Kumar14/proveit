# SignBridge integration

The service entry point is `examples/signbridge/service.py`. Its default model detects a hand, classifies ASL letter landmarks, and rejects missing or uncertain hands instead of classifying arbitrary camera backgrounds. Ordered movement recognition is available through the optional vision provider or a trained upstream SignBridge-ML sequence model.

See [`docs/signbridge.md`](../../docs/signbridge.md) for the Python 3.12 setup, verified model downloader, optional movement-provider configuration, upstream training prerequisites, and commands to run both services.
