"""Bound the entire HTTP body before multipart/JSON parsing, including chunked input."""
import asyncio
from starlette.responses import JSONResponse


class BodyLimitMiddleware:
    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST","PUT","PATCH"}:
            return await self.app(scope, receive, send)
        chunks, size = [], 0
        deadline = asyncio.get_running_loop().time() + 30
        while True:
            try:
                message = await asyncio.wait_for(receive(), max(0.01, deadline - asyncio.get_running_loop().time()))
            except asyncio.TimeoutError:
                return await JSONResponse({"detail":"Время загрузки истекло"}, 408)(scope, receive, send)
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > self.max_bytes:
                return await JSONResponse({"detail":"Запрос слишком большой"}, 413)(scope, receive, send)
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type":"http.request", "body":b"".join(chunks), "more_body":False}

        await self.app(scope, bounded_receive, send)
