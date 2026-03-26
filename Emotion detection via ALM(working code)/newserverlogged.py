# ======================== NGROK TUNNEL SERVER ========================
# NGROK TUNNEL SERVER -> Hosts PyAnnote diarization + Whisper transcription
#                        via a secure public ngrok tunnel.
# ||
# ||
# Functions/Methods -> uvicorn.run() -> Start API server
# ||                 |
# ||                 |---> FastAPI() -> Initialize app instance
# ||                 |---> lifespan() -> Manage startup/shutdown
# ||                 |---> Pipeline.from_pretrained() -> Load PyAnnote model
# ||                 |---> whisper.load_model() -> Load Whisper model
# ||                 |---> pipeline.to() -> Set device CPU or GPU
# ||                 |---> ngrok.set_auth_token() -> Authenticate tunnel
# ||                 |---> ngrok.connect() -> Create public tunnel
# ||                 |---> health_check() -> API endpoint for health status
# ||                 |---> diarize_audio() -> Main processing endpoint
# ||                 |---> os.path.exists() -> Validate local file path
# ||                 |---> librosa.load() -> Load audio file (stereo-aware)
# ||                 |---> torch.from_numpy() -> Convert audio to tensor [C, T]
# ||                 |---> pipeline() -> Run diarization model
# ||                 |---> annotation.itertracks() -> Extract speaker segments
# ||                 |---> _fill_gaps() -> Fill unlabelled gaps between segments
# ||                 |---> _transcribe_segment() -> Whisper transcription per segment
# ||                 |---> ngrok.kill() -> Close tunnel on shutdown
# ||                 |
# ||                 |---> Logic Flow -> API Server Execution Path:
# ||                                  |
# ||                                  |--- __main__ -> Trigger uvicorn.run()
# ||                                  |    └── FastAPI() starts -> Triggers lifespan()
# ||                                  |        ├── Pipeline.from_pretrained() -> Load PyAnnote
# ||                                  |        ├── whisper.load_model() -> Load Whisper
# ||                                  |        ├── ngrok.connect() -> Open Public Tunnel
# ||                                  |        ├── yield -> Server enters active listening state
# ||                                  |        │   ├── /health -> Returns system status
# ||                                  |        │   └── /diarize -> Triggers diarize_audio()
# ||                                  |        │       ├── Validate pipeline & file path
# ||                                  |        │       ├── librosa.load() stereo-aware
# ||                                  |        │       ├── Detect mono / fake stereo / true stereo
# ||                                  |        │       ├── pipeline() -> Execute diarization
# ||                                  |        │       ├── annotation.itertracks() -> Parse segments
# ||                                  |        │       ├── _fill_gaps() -> Fill unlabelled gaps
# ||                                  |        │       ├── _transcribe_segment() -> Whisper per turn
# ||                                  |        │       └── Return JSON -> segments + transcripts
# ||                                  |        └── Server shutdown -> ngrok.kill() -> Clean exit
# ||
# ======================================================================

# ---------------------------------------------------------------
# SECTION: IMPORTS
# ---------------------------------------------------------------
import os
import gc
import tempfile
import warnings

warnings.filterwarnings("ignore", message="torchcodec is not installed correctly")
warnings.filterwarnings("ignore", category=UserWarning, module="pyannote")

import uvicorn
import torch
import librosa
import whisper
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pyannote.audio import Pipeline
from pyngrok import ngrok
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# ---------------------------------------------------------------
# SECTION: CONSTANTS
# ---------------------------------------------------------------

load_dotenv()

HF_TOKEN    = os.getenv("HF_TOKEN")
NGROK_TOKEN = os.getenv("NGROK_TOKEN")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8001"))

if not HF_TOKEN or not NGROK_TOKEN:
    raise RuntimeError(
        "❌ Missing .env values!\n"
        "   Make sure your .env file contains:\n"
        "     HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx\n"
        "     NGROK_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxx\n"
        "     SERVER_PORT=8001  (optional, default 8001)"
    )

# ── Whisper model size ────────────────────────────────────────────────────────
# ACTIVE: medium — good multilingual accuracy, ~3GB RAM, faster
# SWITCH: comment out medium and uncomment large-v3 for max accuracy (~6GB RAM)
WHISPER_MODEL_SIZE = "small"
# WHISPER_MODEL_SIZE = "large-v3"  # ← uncomment for best accuracy

# ── Minimum segment duration ──────────────────────────────────────────────────
# segments shorter than this are skipped for transcription (Whisper gets garbage on <1s)
MIN_SEGMENT_DURATION = 1.0  # seconds

# ── Padding around segment boundaries for Whisper ────────────────────────────
# Whisper misses first/last word when sliced exactly at boundary
# 0.3s padding on each side captures cut-off words without overlapping content
PADDING_SEC = 0.3  # seconds

# ── Gap fill threshold ────────────────────────────────────────────────────────
# PyAnnote leaves unlabelled gaps between speaker turns — audio in these gaps
# is lost unless we extend the previous segment's end to cover it
# Only fill gaps smaller than this threshold to avoid merging distinct turns
GAP_FILL_THRESHOLD = 1.5  # seconds

# ── Global model handles ──────────────────────────────────────────────────────
diarization_pipeline = None
whisper_model        = None

# ---------------------------------------------------------------
# SECTION: LIFESPAN — startup & shutdown
# ---------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n⟶  START lifespan()")
    global diarization_pipeline, whisper_model

    print("\n" + "="*55)
    print("🔹 Checkpoint 1: Starting Diarization + Transcription Bridge...")

    try:
        # ── START: detect device ──────────────────────────────────────────────
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"🔹 Checkpoint 2: Device = {device}")
        if device.type == "cuda":
            vram = torch.cuda.get_device_properties(0).total_memory / 1e9
            print(f"   GPU: {torch.cuda.get_device_name(0)} | VRAM: {vram:.1f} GB")
        # ── END: detect device ────────────────────────────────────────────────

        # ── START: load PyAnnote diarization pipeline ─────────────────────────
        print("🔹 Checkpoint 3: Loading PyAnnote 3.1...")
        diarization_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=HF_TOKEN,  # pyannote 3.x uses 'token' not 'use_auth_token'
        )
        diarization_pipeline.to(device)
        print(f"✅ Checkpoint 4: PyAnnote loaded on {device}!")
        # ── END: load PyAnnote ────────────────────────────────────────────────

        # ── START: load Whisper transcription model ───────────────────────────
        # Strategy: auto-detect language per segment
        # Handles: Hindi, English, Hinglish, Tamil, Telugu, Bengali, Marathi etc.
        # Auto-detect is best for multilingual call center audio because:
        #   - Hinglish switches mid-sentence → fixed language breaks it
        #   - Each speaker segment may be a different language
        #   - Whisper's auto-detect is highly accurate for Indian languages
        print(f"🔹 Checkpoint 5: Loading Whisper ({WHISPER_MODEL_SIZE})...")

        # ── NOTE: Whisper runs on CPU to avoid VRAM competition with PyAnnote ─
        # PyAnnote on GPU: ~1.5GB
        # Whisper medium on GPU: ~3GB
        # Together: ~4.5GB — fine on most GPUs
        # If you have <6GB VRAM: keep whisper_device = "cpu"
        # If you have >=8GB VRAM: change whisper_device = device
        whisper_device = "cpu"
        # whisper_device = device  # ← uncomment if you have >=8GB VRAM

        whisper_model = whisper.load_model(WHISPER_MODEL_SIZE, device=whisper_device)
        print(f"✅ Checkpoint 6: Whisper ({WHISPER_MODEL_SIZE}) loaded on {whisper_device}!")
        # ── END: load Whisper ─────────────────────────────────────────────────

        # ── START: connect ngrok tunnel ───────────────────────────────────────
        print("🔹 Checkpoint 7: Connecting Ngrok Tunnel...")
        ngrok.set_auth_token(NGROK_TOKEN)
        tunnel     = ngrok.connect(addr=str(SERVER_PORT), proto="http")
        public_url = tunnel.public_url

        # force https
        if public_url.startswith("http://"):
            public_url = public_url.replace("http://", "https://", 1)

        print("="*55)
        print(f"\n🚀 PUBLIC URL (copy this into Colab CONFIG):")
        print(f"   {public_url}/diarize")
        print(f"\n📋 Paste this exact URL into your Colab notebook:")
        print(f'   "diarizer_url": "{public_url}/diarize"')
        print("\n⚠️  Keep this terminal open while Colab is running!")
        print("="*55 + "\n")
        # ── END: connect ngrok tunnel ─────────────────────────────────────────

    except Exception as e:
        print(f"❌ Startup Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    yield  # ← server runs here — handles all incoming requests

    # ── START: clean shutdown ─────────────────────────────────────────────────
    print("\n🔹 Shutting down ngrok tunnel...")
    ngrok.kill()
    print("✅ Server shut down cleanly.")
    # ── END: clean shutdown ───────────────────────────────────────────────────

    print("⟵  END   lifespan()\n")


# ---------------------------------------------------------------
# SECTION: APP INIT
# ---------------------------------------------------------------
app = FastAPI(title="Diarization + Transcription Bridge", lifespan=lifespan)


# ---------------------------------------------------------------
# SECTION: CLASSES
# ---------------------------------------------------------------
class AudioRequest(BaseModel):
    file_path: str


# ---------------------------------------------------------------
# SECTION: HELPER FUNCTIONS
# ---------------------------------------------------------------

def _fill_gaps(segments: list, audio_duration: float) -> list:
    """
    Fill unlabelled gaps between PyAnnote speaker turns.

    PyAnnote intentionally leaves gaps between turns when it is uncertain
    about speaker identity. These gaps contain real speech that would
    otherwise be lost. This function extends each segment's end time to
    meet the next segment's start — but only for small gaps under
    GAP_FILL_THRESHOLD to avoid merging genuinely distinct turns.

    Args:
        segments       : list of segment dicts with 'start', 'end', 'speaker'
        audio_duration : total audio duration in seconds (caps last segment)

    Returns:
        list of segments with gaps filled
    """
    print(f"\n⟶  START _fill_gaps()  [segments={len(segments)}, audio_duration={audio_duration:.2f}s]")

    if not segments:
        print("⟵  END   _fill_gaps()  [empty — nothing to fill]\n")
        return segments

    # ── START: fill inter-segment gaps ───────────────────────────────────────
    for i in range(len(segments) - 1):
        gap = segments[i+1]['start'] - segments[i]['end']
        if 0 < gap < GAP_FILL_THRESHOLD:
            # extend current segment end to next segment start
            # gap audio is attributed to the speaker who spoke just before it
            segments[i]['end'] = segments[i+1]['start']
            print(f"   🔗 Gap filled: {segments[i]['speaker']} "
                  f"+{gap:.2f}s → {segments[i]['end']:.3f}s")
    # ── END: fill inter-segment gaps ─────────────────────────────────────────

    # ── START: extend last segment to end of audio if gap is small ───────────
    last_gap = audio_duration - segments[-1]['end']
    if 0 < last_gap < GAP_FILL_THRESHOLD:
        segments[-1]['end'] = audio_duration
        print(f"   🔗 Tail gap filled: {segments[-1]['speaker']} "
              f"+{last_gap:.2f}s → {audio_duration:.3f}s")
    # ── END: extend last segment ──────────────────────────────────────────────

    # recalculate durations after gap filling
    for seg in segments:
        seg['duration'] = round(seg['end'] - seg['start'], 3)

    print(f"⟵  END   _fill_gaps()  [segments={len(segments)} returned]\n")
    return segments


def _transcribe_segment(
    audio_array: np.ndarray,
    sample_rate: int,
    start_sec: float,
    end_sec: float,
) -> dict:
    """
    Transcribe a single speaker segment using Whisper.

    Args:
        audio_array : numpy array of audio samples [T] at sample_rate
                      already padded by PADDING_SEC on both sides
        sample_rate : sample rate of audio_array (should be 16000)
        start_sec   : segment start time in seconds (for logging)
        end_sec     : segment end time in seconds (for logging)

    Returns:
        dict with keys:
            text                    : transcribed text (empty string if too short or error)
            language                : detected language code (e.g. "hi", "en", "ta")
            skipped                 : True if segment was too short to transcribe
            transcription_quality   : dict with Whisper internal quality metrics:
                avg_logprob             : average log-probability of tokens (higher = more certain)
                                          Whisper threshold for hallucination: < -1.0 is unreliable
                no_speech_prob          : probability Whisper thinks there is NO speech (0.0–1.0)
                                          > 0.6 means likely silence/noise, not real speech
                compression_ratio       : ratio of text length to audio tokens
                                          > 2.4 means Whisper may be looping/hallucinating
                transcription_confidence: derived 0.0–1.0 score combining all three metrics
                                          1.0 = Whisper is highly certain, 0.0 = unreliable
    """
    print(f"\n⟶  START _transcribe_segment()  [{start_sec:.2f}s → {end_sec:.2f}s]")

    duration = end_sec - start_sec

    # ── START: skip segments that are too short ───────────────────────────────
    # Whisper returns garbage on segments < 1 second
    if duration < MIN_SEGMENT_DURATION:
        print(f"⟵  END   _transcribe_segment()  [skipped — too short: {duration:.2f}s]\n")
        return {
            "text"    : "",
            "language": "unknown",
            "skipped" : True,
            "reason"  : f"too short ({duration:.2f}s < {MIN_SEGMENT_DURATION}s)",
            "transcription_quality": {
                "avg_logprob"              : None,
                "no_speech_prob"           : None,
                "compression_ratio"        : None,
                "transcription_confidence" : 0.0,
                "quality_flags"            : ["skipped_too_short"],
            },
        }
    # ── END: skip short segments ──────────────────────────────────────────────

    tmp_path = None
    try:
        # ── START: write segment audio to temp WAV file ───────────────────────
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        sf.write(tmp_path, audio_array, sample_rate)
        # ── END: write temp WAV ───────────────────────────────────────────────

        # ── START: run Whisper transcription ──────────────────────────────────
        use_fp16 = (
            whisper_model.device.type == "cuda"
            if hasattr(whisper_model, "device")
            else False
        )

        result = whisper_model.transcribe(
            tmp_path,
            language=None,
            fp16=use_fp16,
            verbose=False,
        )
        # ── END: Whisper transcription ────────────────────────────────────────

        text     = result.get("text",     "").strip()
        language = result.get("language", "unknown")

        # ── START: extract Whisper quality metrics from segments ──────────────
        # Whisper returns per-chunk metrics inside result["segments"]
        # We average them across all chunks in this speaker segment
        whisper_segs = result.get("segments", [])

        if whisper_segs:
            avg_logprob       = float(np.mean([s.get("avg_logprob",       -1.0) for s in whisper_segs]))
            no_speech_prob    = float(np.mean([s.get("no_speech_prob",      0.5) for s in whisper_segs]))
            compression_ratio = float(np.mean([s.get("compression_ratio",   1.0) for s in whisper_segs]))
        else:
            # no segments returned — single-chunk result, use top-level fields if present
            avg_logprob       = float(result.get("avg_logprob",       -0.5))
            no_speech_prob    = float(result.get("no_speech_prob",     0.3))
            compression_ratio = float(result.get("compression_ratio",  1.0))

        # ── START: derive transcription_confidence (0.0–1.0) ─────────────────
        # Three independent signals combined:
        #
        # 1. logprob_score: avg_logprob ranges roughly -3.0 (bad) to 0.0 (perfect)
        #    We map [-2.0, 0.0] → [0.0, 1.0] and clip
        logprob_score = float(np.clip((avg_logprob + 2.0) / 2.0, 0.0, 1.0))
        #
        # 2. speech_score: invert no_speech_prob so 1.0 = definitely speech
        speech_score = float(np.clip(1.0 - no_speech_prob, 0.0, 1.0))
        #
        # 3. compression_score: compression_ratio > 2.4 = hallucination risk
        #    Map [1.0, 2.4] → [1.0, 0.0]
        compression_score = float(np.clip(1.0 - max(0.0, compression_ratio - 1.0) / 1.4, 0.0, 1.0))
        #
        # Weighted combination — logprob is most reliable signal
        transcription_confidence = round(
            0.50 * logprob_score +
            0.30 * speech_score  +
            0.20 * compression_score,
            3
        )
        # ── END: derive confidence ────────────────────────────────────────────

        # ── START: quality flags — human-readable warnings ────────────────────
        quality_flags = []
        if avg_logprob < -1.0:
            quality_flags.append("low_token_probability")
        if no_speech_prob > 0.6:
            quality_flags.append("possible_no_speech")
        if compression_ratio > 2.4:
            quality_flags.append("possible_hallucination")
        if transcription_confidence < 0.4:
            quality_flags.append("low_confidence_overall")
        if not text:
            quality_flags.append("empty_transcript")
        # ── END: quality flags ────────────────────────────────────────────────

        print(
            f"      📝 [{start_sec:.1f}s-{end_sec:.1f}s] "
            f"lang={language} conf={transcription_confidence:.2f} | {text[:80]}"
        )
        if quality_flags:
            print(f"         ⚠️  flags: {quality_flags}")

        print(f"⟵  END   _transcribe_segment()  [{start_sec:.2f}s → {end_sec:.2f}s | lang={language} conf={transcription_confidence:.2f}]\n")
        return {
            "text"    : text,
            "language": language,
            "skipped" : False,
            "transcription_quality": {
                "avg_logprob"              : round(avg_logprob,       3),
                "no_speech_prob"           : round(no_speech_prob,    3),
                "compression_ratio"        : round(compression_ratio, 3),
                "transcription_confidence" : transcription_confidence,
                "quality_flags"            : quality_flags,
            },
        }

    except Exception as e:
        print(f"      ⚠️  Transcription error [{start_sec:.1f}s-{end_sec:.1f}s]: {e}")
        print(f"⟵  END   _transcribe_segment()  [error at {start_sec:.2f}s → {end_sec:.2f}s]\n")
        return {
            "text"    : "",
            "language": "unknown",
            "skipped" : False,
            "error"   : str(e),
            "transcription_quality": {
                "avg_logprob"              : None,
                "no_speech_prob"           : None,
                "compression_ratio"        : None,
                "transcription_confidence" : 0.0,
                "quality_flags"            : ["transcription_error"],
            },
        }

    finally:
        # ── always delete temp file even if transcription throws ───────────────
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


# ---------------------------------------------------------------
# SECTION: ENDPOINTS
# ---------------------------------------------------------------

@app.get("/health")
async def health_check():
    """
    Health check — Colab pings this before sending audio
    to verify server is alive and both models are loaded.
    """
    print("\n⟶  START health_check()")
    response = {
        "status"              : "ok",
        "pipeline_loaded"     : diarization_pipeline is not None and whisper_model is not None,
        "diarization_loaded"  : diarization_pipeline is not None,
        "transcription_loaded": whisper_model is not None,
        "whisper_model"       : WHISPER_MODEL_SIZE,
        "device"              : str(torch.device("cuda" if torch.cuda.is_available() else "cpu")),
    }
    print(f"⟵  END   health_check()  [status={response['status']} | pipeline_loaded={response['pipeline_loaded']}]\n")
    return response


@app.post("/diarize")
async def diarize_audio(request: AudioRequest):
    """
    Receives a local file path from Colab via ngrok tunnel.
    Runs PyAnnote speaker diarization + Whisper transcription per segment.
    Fills gaps between speaker turns to prevent data loss.
    Uses PADDING_SEC boundary padding to prevent word clipping.
    Returns speaker turns with timestamps AND transcription text.

    Request body:
        {"file_path": "C:\\calls\\recording.wav"}

    Response:
        {
            "segments": [
                {
                    "start"      : 0.5,
                    "end"        : 3.2,
                    "speaker"    : "SPEAKER_00",
                    "transcript" : {
                        "text"    : "Mera naam John hai",
                        "language": "hi",
                        "skipped" : false
                    }
                },
                ...
            ],
            "num_speakers": 2
        }
    """
    print(f"\n⟶  START diarize_audio()  [file={request.file_path}]")

    # ── START: validate models loaded ─────────────────────────────────────────
    if diarization_pipeline is None:
        print("⟵  END   diarize_audio()  [aborted — diarization pipeline not loaded]\n")
        raise HTTPException(
            status_code=503,
            detail="Diarization pipeline not loaded yet. Wait for startup to finish.",
        )
    if whisper_model is None:
        print("⟵  END   diarize_audio()  [aborted — whisper model not loaded]\n")
        raise HTTPException(
            status_code=503,
            detail="Whisper model not loaded yet. Wait for startup to finish.",
        )
    # ── END: validate models loaded ───────────────────────────────────────────

    # ── START: validate file exists locally ──────────────────────────────────
    if not os.path.exists(request.file_path):
        print(f"⟵  END   diarize_audio()  [aborted — file not found: {request.file_path}]\n")
        raise HTTPException(
            status_code=404,
            detail=(
                f"File not found on local machine: {request.file_path}\n"
                "Make sure the audio file is in the correct folder\n"
                "and the path in your Colab notebook matches exactly."
            ),
        )
    # ── END: validate file exists locally ────────────────────────────────────

    try:
        print(f"\n📂 Processing: {request.file_path}")

        # ── START: load audio with librosa (stereo-aware) ─────────────────────
        # mono=False: preserve all channels for stereo detection
        # sr=16000: PyAnnote and Whisper both work best at 16kHz
        y, sr = librosa.load(request.file_path, sr=16000, mono=False)
        # ── END: load audio ───────────────────────────────────────────────────

        # ── START: detect channel count → build correct tensor shape ──────────
        # case 1: mono    → [1, T]
        # case 2: fake stereo (channels identical) → collapse to mono [1, T]
        # case 3: true stereo → keep [C, T] → better diarization accuracy
        if y.ndim == 1:
            num_channels  = 1
            waveform      = torch.from_numpy(y).unsqueeze(0)
            audio_mono    = y
            audio_duration = len(y) / sr
            print(f"   Loaded: {audio_duration:.1f}s | {sr}Hz | mono")

        else:
            num_channels   = y.shape[0]
            audio_duration = y.shape[1] / sr
            diff           = float(np.mean(np.abs(y[0] - y[1]))) if num_channels == 2 else 1.0
            print(f"   Loaded: {audio_duration:.1f}s | {sr}Hz | {num_channels} channels")

            if num_channels == 2 and diff < 0.001:
                # fake stereo — collapse to mono
                print(f"   ⚠️  Fake stereo (diff={diff:.4f}) — collapsing to mono")
                waveform     = torch.from_numpy(y[0]).unsqueeze(0)
                audio_mono   = y[0]
                num_channels = 1
            else:
                # true stereo — keep all channels for PyAnnote
                print(f"   ✅ True stereo (diff={diff:.4f}) — keeping {num_channels} channels")
                waveform   = torch.from_numpy(y)
                audio_mono = np.mean(y, axis=0)  # mix down to mono for Whisper
        # ── END: detect channel count ─────────────────────────────────────────

        # ── START: run PyAnnote diarization ───────────────────────────────────
        audio_payload      = {"waveform": waveform, "sample_rate": sr}
        diarization_result = diarization_pipeline(
            audio_payload,
            min_speakers=2,
            max_speakers=4,
        )
        # ── END: run PyAnnote diarization ─────────────────────────────────────

        # ── START: extract annotation object ─────────────────────────────────
        # PyAnnote may wrap result in different attributes depending on version
        print(f"   Result type: {type(diarization_result).__name__}")

        if hasattr(diarization_result, "speaker_diarization"):
            annotation = diarization_result.speaker_diarization
        elif hasattr(diarization_result, "annotation"):
            annotation = diarization_result.annotation
        elif hasattr(diarization_result, "diarization"):
            annotation = diarization_result.diarization
        else:
            annotation = diarization_result
        # ── END: extract annotation object ───────────────────────────────────

        # ── START: collect raw segments from annotation ───────────────────────
        raw_segments = []
        for t, track, speaker in annotation.itertracks(yield_label=True):
            # PyAnnote >= 3.0 may expose a confidence score on the track object.
            # Safely read it — fall back to None if not available on this version.
            diarization_confidence = None
            try:
                score_val = getattr(track, "score", None)
                if score_val is not None:
                    diarization_confidence = round(float(score_val), 3)
            except Exception:
                pass

            raw_segments.append({
                "start"                  : t.start,
                "end"                    : t.end,
                "duration"               : round(t.end - t.start, 3),
                "speaker"                : speaker,
                "diarization_confidence" : diarization_confidence,
            })
        print(f"   Raw segments from PyAnnote: {len(raw_segments)}")
        # ── END: collect raw segments ─────────────────────────────────────────

        # ── START: fill gaps between speaker turns ────────────────────────────
        # PyAnnote leaves unlabelled gaps — fill them to prevent audio data loss
        # gaps under GAP_FILL_THRESHOLD are absorbed by the preceding segment
        raw_segments = _fill_gaps(raw_segments, audio_duration)
        print(f"   Segments after gap fill: {len(raw_segments)}")
        # ── END: fill gaps ────────────────────────────────────────────────────

        # ── START: build segments list with padded transcription ──────────────
        # For each speaker turn:
        #   1. Slice audio with PADDING_SEC on both sides to avoid word clipping
        #   2. Run Whisper on the padded slice
        #   3. Append segment + transcript to results
        # NOTE: segment start/end timestamps are the ORIGINAL boundaries,
        #       padding is only applied to the audio passed to Whisper
        segments = []

        for seg in raw_segments:
            start_sec = seg['start']
            end_sec   = seg['end']
            duration  = seg['duration']

            # ── START: apply boundary padding for Whisper ─────────────────────
            # padding prevents Whisper from missing the first/last word
            # clamp to [0, audio_duration] to avoid out-of-bounds slice
            padded_start = max(0.0, start_sec - PADDING_SEC)
            padded_end   = min(audio_duration, end_sec + PADDING_SEC)

            start_sample  = int(padded_start * sr)
            end_sample    = int(padded_end   * sr)
            segment_audio = audio_mono[start_sample:end_sample]
            # ── END: apply boundary padding ───────────────────────────────────

            # run Whisper transcription on padded audio slice
            # pass original start/end for logging — not padded times
            transcript = _transcribe_segment(
                audio_array=segment_audio,
                sample_rate=sr,
                start_sec=start_sec,
                end_sec=end_sec,
            )

            segments.append({
                "start"                  : round(start_sec, 3),
                "end"                    : round(end_sec,   3),
                "duration"               : round(duration,  3),
                "speaker"                : seg['speaker'],
                "diarization_confidence" : seg.get("diarization_confidence"),
                "transcript"             : transcript,
            })

        # cleanup memory
        gc.collect()
        # ── END: build segments list ──────────────────────────────────────────

        num_speakers = len(set(s["speaker"] for s in segments))
        print(f"✅ Done! {len(segments)} turns | {num_speakers} speakers")
        print(f"⟵  END   diarize_audio()  [segments={len(segments)} | speakers={num_speakers}]\n")

        return {
            "segments"    : segments,
            "num_speakers": num_speakers,
        }

    except HTTPException:
        raise  # re-raise HTTP errors unchanged

    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        print(f"⟵  END   diarize_audio()  [exception: {type(e).__name__}]\n")
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


# ---------------------------------------------------------------
# SECTION: ENTRY POINT
# ---------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=SERVER_PORT)