FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOST=0.0.0.0 APP_ENV=production ALLOW_LOCAL_LOGIN=false DATABASE_URL=sqlite+aiosqlite:////data/finance.db
WORKDIR /app
COPY bot/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home appuser && mkdir /data && chown appuser /data
COPY bot/ ./bot/
COPY --from=frontend /build/dist ./frontend/dist
USER appuser
WORKDIR /app/bot
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/ready')"
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
