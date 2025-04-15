import time

import torch
from transformers import pipeline


def transcribe_with_model(file_name: str, model_name: str):
    return _transcribe_with_kotoba_whisper(file_name)


def _transcribe_with_kotoba_whisper(file_name: str):
    # config
    model_id = "kotoba-tech/kotoba-whisper-v1.1"
    torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    model_kwargs = {"attn_implementation": "sdpa"} if torch.cuda.is_available() else {}
    # load model
    pipe = pipeline(
        model=model_id,
        torch_dtype=torch_dtype,
        device=device,
        model_kwargs=model_kwargs,
        chunk_length_s=15,
        batch_size=16,
        trust_remote_code=True,
        stable_ts=True,
        punctuator=True,
    )
    generate_kwargs = {"language": "japanese", "task": "transcribe"}  # TODO: language
    start_time = time.time()
    result = pipe(file_name, return_timestamps=True, generate_kwargs=generate_kwargs)
    process_time = time.time() - start_time

    segments = list(
        map(
            lambda c: {
                "start": c["timestamp"][0],
                "end": c["timestamp"][1],
                "text": c["text"],
            },
            result["chunks"],
        )
    )
    return {
        "text": result["text"],
        "lang": "ja",
        "segments": segments,
        "stats": {"process_time": process_time},
    }
