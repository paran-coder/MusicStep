# MusicStep-v1.0.0 third-party assets

Date: 2026-10-29

- YAMNet float32 version 1: https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite
  - Publisher: Google / TensorFlow. License: Apache-2.0.
  - Model card: https://www.kaggle.com/models/google/yamnet/TensorFlow2/yamnet/1
  - Model size: 4,126,810 bytes.
  - SHA256: 4d8b4a53282dc83ef04e3e7dbc4fbc98082e34e44ed798e16c3a0cdd4c584faf
  - Classification labels: https://github.com/tensorflow/models/blob/master/research/audioset/yamnet/yamnet_class_map.csv
  - Included license: public/models/2026-10-29-YAMNet-LICENSE.txt
  - This general sound classifier is not calibrated for first sung lyric alignment. Scores are not task accuracy probabilities.
- @mediapipe/tasks-audio 0.10.32: https://www.npmjs.com/package/@mediapipe/tasks-audio
  - Publisher: Google. License: Apache-2.0.
  - Local CJS bundle and both SIMD / no-SIMD WASM runtimes are copied from the pinned package into public/vendor.
  - Included license: public/vendor/2026-10-29-MediaPipe-LICENSE.txt
- fflate 0.8.3: https://www.npmjs.com/package/fflate
  - Publisher: 101arrowz. License: MIT. Bundled by Vite.
  - Included license: public/vendor/2026-10-29-fflate-LICENSE.txt
- Vite 7.3.7 and Playwright 1.56.1 are development tools declared in package.json; npm resolves their own licenses with package installation.

All runtime assets are served from the app's own origin. No CDN, inference API, microphone access, or third-party analytics is configured. App/model download requests still disclose normal connection metadata to the hosting provider; selected user content is not transmitted.

Static-host compatibility: the unchanged MediaPipe CJS runtime is also distributed as public/vendor/2026-10-29-audio-runtime.js, so browsers receive a JavaScript MIME type. The original audio_bundle.cjs is retained; the worker loads the .js copy.

## v1.1.0 model and runtime update (2026-10-29)

- UVR-MDX-NET-Voc_FT ONNX: https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Voc_FT.onnx
  - 66,762,490 bytes. SHA256: 534b2070fcc7df514b13ef660dc8cbb328679c2374d04354a5c42bb14ecce111
  - Credits: Ultimate Vocal Remover, Anjok07, aufr33, and the MDX-Net contributors.
  - UVR licensing guidance explicitly requests third-party applications honor MIT and credit UVR and its developers: https://github.com/Anjok07/ultimatevocalremovergui#license
- web-audio-separation 0.3.1: MIT, Copyright (c) 2026 Dan Kurtz. Only PffftSTFT preprocessing is used; model fetching and ONNX session creation are implemented locally to avoid its default CDN routes.
  - The embedded pffft FFT derives from the pffft project: https://bitbucket.org/jpommier/pffft/
  - License copy: public/vendor/2026-10-29-web-audio-separation-LICENSE.txt
- onnxruntime-web 1.31.1: MIT, Microsoft Corporation.
  - License copy: public/vendor/2026-10-29-ONNXRuntime-LICENSE.txt
  - Official runtime files are served from public/vendor/ort; no remote runtime URLs are invoked.
- The MDX worker processes 44.1 kHz stereo using n_fft=7680, hop=1024, dim_f=3072, 256 frames. It removes 3840 context samples at each chunk edge and preserves timeline position. It estimates onset from sustained separated-vocal energy without looking up a sample filename or hardcoding a target time.

## v1.2.0 fast singing-presence detector (2026-10-29)

- SingingVoiceDetection: https://github.com/keums/SingingVoiceDetection
  - Upstream commit: abcd8062d24e97ebac81d6efc1653b9dd55b9409
  - MIT, Copyright (c) 2018 Sangeun Kum. License copied to public/vendor/2026-10-29-SingingVoiceDetection-LICENSE.txt.
  - The released Keras 2.1.2 weights (weights/SVAD_CNN_ML.hdf5) and training mean/std were converted to ONNX without training or user audio. See 2026-10-29-convert-svad.py. Conversion tools are local build/research tools, not app runtime dependencies.
  - Browser model: 9,557,584 bytes, SHA256 d158b103ed2ad633ac24bdf89643edd5991e0b7c244b66ffc0784c99c1de9f96.
  - Preprocessing follows upstream load_feature.py: 16 kHz mono, FFT 1024, hop 160, 80 Slaney mel bands, max-referenced power dB; 75-frame windows. Training normalization is embedded in the ONNX graph.
  - Uses direct vocal/nonvocal classification, not source separation or lyrics recognition. Coarse search is followed by finer temporal search; candidates still need review.
- Silero VAD was evaluated but was not reliable on the two music samples and is NOT the default detector.
  - Official upstream commit: 066409f3d9db45a30d21dfcbf9147826ffdd7052; MIT, Silero authors.
  - Research model: 2,327,524 bytes; SHA256 1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3.
  - License: public/vendor/2026-10-29-Silero-LICENSE.txt.
- Essentia/MTG voice models were not included; their published noncommercial model terms were not substituted into this app.
- Main analysis defaults to SingingVoiceDetection. UVR separation is used only when explicitly selected in the analysis method control. No third-party CDN or inference service is used.
