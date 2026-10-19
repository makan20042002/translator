"""
MAKAN Translate - Python ASR Helper Server
Provides local Speech-to-Text inference for Whisper large-v3 and Qwen3-ASR
via an OpenAI-compatible /v1/audio/transcriptions API.
"""

import os
import sys
import gc
import logging
import tempfile
from typing import Optional, Dict, Any

import torch
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("makan-asr-helper")

app = FastAPI(
    title="MAKAN Translate ASR Helper",
    version="1.0.0",
    description="Local Speech-to-Text inference server for Whisper large-v3 & Qwen3-ASR"
)

# Enable CORS for local app and web access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supported models mapping
MODEL_MAP = {
    "whisper-large-v3": "openai/whisper-large-v3",
    "whisper-large-v3-turbo": "openai/whisper-large-v3-turbo",
    "qwen3-asr": os.environ.get("QWEN_ASR_MODEL", "Qwen/Qwen3-ASR-0.6B"),
    "qwen3-asr-1.7b": "Qwen/Qwen3-ASR-1.7B",
    "qwen2-audio": "Qwen/Qwen2-Audio-7B-Instruct",
}

# In-memory pipeline cache
loaded_pipeline = None
loaded_model_id: Optional[str] = None


def get_device_info():
    cuda_available = torch.cuda.is_available()
    device = "cuda:0" if cuda_available else "cpu"
    torch_dtype = torch.float16 if cuda_available else torch.float32
    return device, torch_dtype, cuda_available


def ensure_default_rope_registered():
    try:
        from transformers.modeling_rope_utils import ROPE_INIT_FUNCTIONS
        if "default" not in ROPE_INIT_FUNCTIONS:
            def default_rope_init(config, dev=None):
                base = getattr(config, 'rope_theta', 1000000.0)
                if hasattr(config, 'rope_parameters') and isinstance(config.rope_parameters, dict) and 'rope_theta' in config.rope_parameters:
                    base = config.rope_parameters['rope_theta']
                dim = getattr(config, 'head_dim', None) or (config.hidden_size // config.num_attention_heads)
                inv_freq = 1.0 / (base ** (torch.arange(0, dim, 2, dtype=torch.float) / dim))
                if dev:
                    inv_freq = inv_freq.to(dev)
                return inv_freq, 1.0
            ROPE_INIT_FUNCTIONS['default'] = default_rope_init
    except Exception:
        pass


class Qwen3ASRWrapper:
    def __init__(self, model_id: str, device: str, torch_dtype: Any):
        self.model_id = model_id
        self.device = device
        self.torch_dtype = torch_dtype
        logger.info(f"Initializing Qwen3-ASR model for {model_id} on {device}...")
        ensure_default_rope_registered()
        from qwen_asr import Qwen3ASRModel
        self.model = Qwen3ASRModel.from_pretrained(
            model_id,
            dtype=torch_dtype,
            device_map=device if device != "cpu" else None,
        )

    def __call__(self, audio_path: str, **kwargs) -> Dict[str, str]:
        gen_kwargs = kwargs.get("generate_kwargs", {})
        lang = gen_kwargs.get("language")
        lang_map = {"fa": "Persian", "en": "English", "zh": "Chinese", "ar": "Arabic", "es": "Spanish", "fr": "French", "de": "German"}
        qwen_lang = lang_map.get(lang, lang) if lang else None
        res = self.model.transcribe(audio=audio_path, language=qwen_lang)
        text = res[0].text if res and len(res) > 0 else ""
        return {"text": text.strip()}


class QwenAudioPipeline:
    def __init__(self, model_id: str, device: str, torch_dtype: Any):
        self.model_id = model_id
        self.device = device
        self.torch_dtype = torch_dtype
        logger.info(f"Initializing Qwen Audio Pipeline for {model_id} on {device}...")
        from transformers import AutoProcessor
        self.processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        try:
            from transformers import Qwen2AudioForConditionalGeneration
            self.model = Qwen2AudioForConditionalGeneration.from_pretrained(
                model_id,
                torch_dtype=torch_dtype,
                device_map=device if device != "cpu" else None,
                trust_remote_code=True
            )
        except Exception as e:
            logger.warning(f"Failed to load Qwen2AudioForConditionalGeneration: {e}. Trying AutoModelForCausalLM...")
            from transformers import AutoModelForCausalLM
            self.model = AutoModelForCausalLM.from_pretrained(
                model_id,
                torch_dtype=torch_dtype,
                device_map=device if device != "cpu" else None,
                trust_remote_code=True
            )
        if device == "cpu":
            self.model = self.model.to("cpu")
        self.model.eval()

    def __call__(self, audio_path: str, **kwargs) -> Dict[str, str]:
        import subprocess
        import numpy as np

        # Extract 16kHz mono audio via ffmpeg
        try:
            cmd = ["ffmpeg", "-y", "-i", audio_path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"]
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=True)
            audio_data = np.frombuffer(proc.stdout, dtype=np.int16).astype(np.float32) / 32768.0
        except Exception as err:
            logger.warning(f"FFmpeg audio extraction failed: {err}. Trying wave module...")
            import wave
            with wave.open(audio_path, "rb") as wf:
                raw_bytes = wf.readframes(wf.getnframes())
                audio_data = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0

        gen_kwargs = kwargs.get("generate_kwargs", {})
        lang = gen_kwargs.get("language")
        prompt = "<|audio_bos|><|AUDIO|><|audio_eos|>Generate the transcription of the speech."
        if lang == "fa":
            prompt = "<|audio_bos|><|AUDIO|><|audio_eos|>متن گفتار را بنویسید."

        inputs = self.processor(text=prompt, audios=audio_data, return_tensors="pt")
        if self.device != "cpu":
            inputs = {k: v.to(self.device) if hasattr(v, "to") else v for k, v in inputs.items()}

        with torch.no_grad():
            gen_ids = self.model.generate(**inputs, max_new_tokens=gen_kwargs.get("max_new_tokens", 256))
            gen_ids = gen_ids[:, inputs["input_ids"].size(1):]
            text = self.processor.batch_decode(gen_ids, skip_special_tokens=True, clean_up_tokenization_spaces=False)[0]
        return {"text": text.strip()}


def load_model(model_key: str):
    global loaded_pipeline, loaded_model_id

    canonical_key = model_key.lower().strip()
    if canonical_key not in MODEL_MAP:
        # Check if user passed full HF repo path or match alias
        matched = False
        for k in MODEL_MAP:
            if k in canonical_key or canonical_key in k:
                canonical_key = k
                matched = True
                break
        if not matched:
            raise ValueError(f"Unknown model: '{model_key}'. Available: {list(MODEL_MAP.keys())}")

    if loaded_pipeline is not None and loaded_model_id == canonical_key:
        return loaded_pipeline

    hf_repo = MODEL_MAP[canonical_key]
    device, torch_dtype, cuda_available = get_device_info()
    logger.info(f"Loading ASR model '{canonical_key}' ({hf_repo}) on {device} (dtype={torch_dtype})...")

    # Free previously loaded model
    if loaded_pipeline is not None:
        del loaded_pipeline
        loaded_pipeline = None
        gc.collect()
        if cuda_available:
            torch.cuda.empty_cache()

    if "qwen3" in canonical_key:
        try:
            pipe = Qwen3ASRWrapper(hf_repo, device=device, torch_dtype=torch_dtype)
        except (ModuleNotFoundError, ImportError) as imp_err:
            logger.error(f"Missing required dependency for Qwen3-ASR: {imp_err}")
            raise
        except Exception as q3_err:
            logger.warning(f"Qwen3ASRWrapper failed ({q3_err}), trying standard pipeline...")
            try:
                from transformers import pipeline
                pipe = pipeline(
                    "automatic-speech-recognition",
                    model=hf_repo,
                    torch_dtype=torch_dtype,
                    device=device,
                    trust_remote_code=True,
                )
            except Exception as e:
                logger.info(f"Standard ASR pipeline for {hf_repo} not supported ({e}), using specialized QwenAudioPipeline.")
                pipe = QwenAudioPipeline(hf_repo, device=device, torch_dtype=torch_dtype)
    elif "qwen" in canonical_key:
        try:
            from transformers import pipeline
            pipe = pipeline(
                "automatic-speech-recognition",
                model=hf_repo,
                torch_dtype=torch_dtype,
                device=device,
                trust_remote_code=True,
            )
        except Exception as e:
            logger.info(f"Standard ASR pipeline for {hf_repo} not supported ({e}), using specialized QwenAudioPipeline.")
            pipe = QwenAudioPipeline(hf_repo, device=device, torch_dtype=torch_dtype)
    else:
        # Whisper pipeline
        # Check if faster-whisper is installed
        faster_loaded = False
        try:
            from faster_whisper import WhisperModel
            compute_type = "float16" if cuda_available else "int8"
            fw_device = "cuda" if cuda_available else "cpu"
            model_alias = "large-v3" if "large-v3" in canonical_key else canonical_key
            if canonical_key == "whisper-large-v3-turbo":
                model_alias = "large-v3-turbo"
            logger.info(f"Attempting faster-whisper loading for {model_alias} ({fw_device}, {compute_type})...")
            fw_model = WhisperModel(model_alias, device=fw_device, compute_type=compute_type)

            class FWWrapper:
                def __init__(self, m):
                    self.m = m
                def __call__(self, audio_path, **kw):
                    gen = kw.get("generate_kwargs", {})
                    l = gen.get("language")
                    segs, _ = self.m.transcribe(audio_path, language=l, beam_size=5)
                    return {"text": " ".join([s.text for s in segs]).strip()}

            pipe = FWWrapper(fw_model)
            faster_loaded = True
            logger.info("Using faster-whisper backend for ultra-fast Whisper inference.")
        except Exception as fw_err:
            logger.info(f"faster-whisper not used ({fw_err}), falling back to transformers pipeline.")

        if not faster_loaded:
            from transformers import pipeline
            pipe = pipeline(
                "automatic-speech-recognition",
                model=hf_repo,
                torch_dtype=torch_dtype,
                device=device,
                chunk_length_s=30,
            )

    loaded_pipeline = pipe
    loaded_model_id = canonical_key
    logger.info(f"Model '{canonical_key}' successfully loaded.")
    return loaded_pipeline


class LoadModelRequest(BaseModel):
    model: str


@app.get("/")
def root():
    device, _, cuda_avail = get_device_info()
    return {
        "service": "MAKAN Translate ASR Helper",
        "status": "ready",
        "device": device,
        "cuda": cuda_avail,
        "active_model": loaded_model_id,
        "supported_models": list(MODEL_MAP.keys()),
        "docs": "/docs",
    }


@app.get("/health")
def health():
    device, _, cuda_avail = get_device_info()
    return {
        "status": "ok",
        "device": device,
        "cuda": cuda_avail,
        "loaded_model": loaded_model_id,
        "available_models": list(MODEL_MAP.keys()),
    }


@app.get("/v1/models")
def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": k,
                "object": "model",
                "owned_by": "makan-translate",
                "active": (k == loaded_model_id),
                "repo": MODEL_MAP[k],
            }
            for k in MODEL_MAP
        ],
    }


@app.post("/v1/models/load")
def api_load_model(req: LoadModelRequest):
    try:
        load_model(req.model)
        return {"status": "loaded", "model": loaded_model_id}
    except ModuleNotFoundError as e:
        missing = getattr(e, "name", None) or str(e)
        detail = f"No module named '{missing}'"
        logger.error(f"Missing package loading model '{req.model}': {detail}")
        raise HTTPException(status_code=500, detail=detail)
    except ImportError as e:
        missing = getattr(e, "name", None)
        detail = f"No module named '{missing}'" if missing else str(e)
        logger.error(f"Import error loading model '{req.model}': {detail}")
        raise HTTPException(status_code=500, detail=detail)
    except Exception as e:
        logger.error(f"Error loading model {req.model}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/models/unload")
def api_unload_model():
    global loaded_pipeline, loaded_model_id
    if loaded_pipeline is not None:
        del loaded_pipeline
        loaded_pipeline = None
        loaded_model_id = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    return {"status": "unloaded"}


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form("whisper-large-v3"),
    language: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
    response_format: Optional[str] = Form("json"),
    temperature: Optional[float] = Form(0.0),
):
    """
    OpenAI-compatible transcription endpoint.
    Transcribes uploaded audio file using Whisper large-v3 or Qwen3-ASR.
    """
    logger.info(f"Transcription request received: model='{model}', language='{language}', file='{file.filename}'")

    # Suffix for temp file
    suffix = ".wav"
    if file.filename:
        _, ext = os.path.splitext(file.filename)
        if ext:
            suffix = ext.lower()

    # Save to temp file
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            temp_path = tmp.name
            content = await file.read()
            tmp.write(content)

        # Ensure model is ready
        pipe = load_model(model)

        # Prepare generate kwargs
        generate_kwargs: Dict[str, Any] = {}
        if language and language != "auto":
            # Normalize language code e.g. fa, en
            norm_lang = language.split("-")[0].lower()
            generate_kwargs["language"] = norm_lang
        if prompt:
            generate_kwargs["prompt_ids"] = prompt

        if temperature and temperature > 0:
            generate_kwargs["temperature"] = temperature

        # Execute transcription
        kwargs = {}
        if generate_kwargs:
            kwargs["generate_kwargs"] = generate_kwargs

        logger.info(f"Running inference on {temp_path}...")
        result = pipe(temp_path, **kwargs)

        transcription_text = ""
        if isinstance(result, dict):
            transcription_text = result.get("text", "")
        elif isinstance(result, list) and len(result) > 0:
            transcription_text = " ".join([r.get("text", "") for r in result])
        elif isinstance(result, str):
            transcription_text = result

        transcription_text = transcription_text.strip()
        logger.info(f"Transcription complete: {transcription_text[:80]}...")

        if response_format == "text":
            return PlainTextResponse(transcription_text)

        return JSONResponse({"text": transcription_text})

    except Exception as e:
        logger.error(f"Inference error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


def main():
    import uvicorn
    port = int(os.environ.get("MAKAN_ASR_PORT", 8765))
    host = os.environ.get("MAKAN_ASR_HOST", "127.0.0.1")
    logger.info(f"Starting MAKAN Translate ASR Helper on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
