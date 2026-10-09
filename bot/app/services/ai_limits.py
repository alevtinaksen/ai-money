"""One bounded slot per external request, shared by generation and transcription."""
import asyncio
from contextlib import asynccontextmanager
from weakref import WeakKeyDictionary

# A running application uses one loop. Per-loop state also avoids retaining a
# semaphore bound to a closed loop in independent test/application lifecycles.
_slots_by_loop = WeakKeyDictionary()
CLOUD_WAIT_SECONDS = 2
CLOUD_REQUEST_SECONDS = 45


@asynccontextmanager
async def cloud_slot():
    loop = asyncio.get_running_loop()
    slots = _slots_by_loop.get(loop)
    if slots is None:
        slots = _slots_by_loop[loop] = asyncio.Semaphore(4)
    try:
        await asyncio.wait_for(slots.acquire(), timeout=CLOUD_WAIT_SECONDS)
    except TimeoutError:
        raise ValueError("Распознавание занято; повторите позже") from None
    try:
        async with asyncio.timeout(CLOUD_REQUEST_SECONDS):
            yield
    finally:
        slots.release()
