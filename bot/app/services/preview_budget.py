"""Small per-process preview budget; cloud requests also use a concurrency bound."""
from collections import OrderedDict
import time
from fastapi import HTTPException

_windows: OrderedDict[int, tuple[float, int]] = OrderedDict()


def consume_preview(user_id: int) -> None:
    now = time.monotonic()
    start, count = _windows.get(user_id, (now, 0))
    if now - start >= 60:
        start, count = now, 0
    if count >= 10:
        raise HTTPException(429, "Не более 10 распознаваний в минуту; повторите позже")
    _windows[user_id] = (start, count + 1)
    _windows.move_to_end(user_id)
    if len(_windows) > 10000:
        _windows.popitem(last=False)
