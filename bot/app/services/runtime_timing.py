"""Stage latency only; never log arguments, return values or exceptions."""
import logging
from contextlib import contextmanager
from functools import wraps
from time import perf_counter

# Use the existing server logger, without enabling HTTP client logs: Telegram
# request URLs can contain tokens. No broad logging configuration is changed.
logger = logging.getLogger("uvicorn.error")
STAGES = {"gemini", "bot_preview", "bot_download", "draft_create", "draft_confirm", "bot_confirmation"}


@contextmanager
def timed_stage(stage: str):
    if stage not in STAGES:
        raise ValueError("Unknown timing stage")
    start = perf_counter()
    completed = False
    try:
        yield
        completed = True
    finally:
        logger.info("ai_money_timing stage=%s ms=%d completed=%s",
                    stage, round((perf_counter() - start) * 1000), completed)


def timed_operation(stage: str):
    if stage not in STAGES:
        raise ValueError("Unknown timing stage")

    def decorate(function):
        @wraps(function)
        async def measured(*args, **kwargs):
            with timed_stage(stage):
                return await function(*args, **kwargs)
        return measured
    return decorate
