import asyncio, hashlib, hmac, json, urllib.parse
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from app.api.deps import get_current_user_id
from app.core.config import settings
from app.core.security import validate_telegram_init_data
from app.services.ai_parser import AIParserService

settings.DEBUG = False
settings.GROQ_API_KEY = None
settings.GEMINI_API_KEY = None
app = FastAPI()
@app.get('/probe')
async def probe(uid: int = Depends(get_current_user_id)):
    return {'resolved_user_id': uid}
client = TestClient(app)
for label, url, headers in [('no_credentials','/probe',{}), ('arbitrary_query','/probe?user_id=424242',{}), ('arbitrary_header','/probe',{'X-User-Id':'434343'}), ('invalid_signature','/probe', {'Authorization':'tma user=garbage&hash=wrong'})]:
    response = client.get(url, headers=headers)
    print(json.dumps({'case':label,'DEBUG':settings.DEBUG,'status':response.status_code,'response':response.json()}))
payload = {'auth_date':'1', 'user':json.dumps({'id':454545})}
check = '\n'.join(f'{k}={payload[k]}' for k in sorted(payload))
key = hmac.new(b'WebAppData', settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
payload['hash'] = hmac.new(key,check.encode(),hashlib.sha256).hexdigest()
print(json.dumps({'case':'signed_auth_date_unix_1','result':validate_telegram_init_data(urllib.parse.urlencode(payload),settings.BOT_TOKEN)}))
async def main():
    for text in ['Кофе 250.50', 'Кофе 250,50', 'Кофе 1 500', 'Кофе 26/09 500', 'Кофе 0.1+0.2', 'Кофе 200 и маникюр', 'Кофе -250']:
        result = await AIParserService.parse_financial_text(text,['Основной','Наличные'],['Еда','Личное'])
        print(json.dumps({'case':'parser','input':text,'normalized':AIParserService.normalize_speech_numbers(AIParserService.evaluate_plus_expressions(text)),'result':result.model_dump()},ensure_ascii=False))
asyncio.run(main())
