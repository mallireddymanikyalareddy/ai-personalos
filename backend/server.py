import asyncio
import json
import os
import subprocess
import uuid
from contextlib import asynccontextmanager
from http.cookiejar import CookieJar, DefaultCookiePolicy

import httpx
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
API_PORT = "8080"
UPSTREAM = f"http://127.0.0.1:{API_PORT}"
HOP_HEADERS = {"connection", "keep-alive", "transfer-encoding", "te", "upgrade", "content-length", "content-encoding", "host"}

proc = None
client = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global proc, client
    env = {**os.environ, "PORT": API_PORT, "HOST": "127.0.0.1", "PGLITE_DATA_DIR": os.path.join(ROOT, "data", "pglite")}
    proc = subprocess.Popen(["npm", "run", "start", "--workspace", "@personalos/api"], cwd=ROOT, env=env, start_new_session=True)
    client = httpx.AsyncClient(base_url=UPSTREAM, timeout=60, cookies=CookieJar(policy=DefaultCookiePolicy(allowed_domains=[])))
    for _ in range(120):
        try:
            await client.get("/healthz")
            break
        except httpx.HTTPError:
            await asyncio.sleep(0.5)
    yield
    await client.aclose()
    os.killpg(proc.pid, 15)


app = FastAPI(lifespan=lifespan)

SYSTEM_PROMPT = (
    "You are the AI assistant inside LifeOS, a personal operating system for tasks, goals, habits, notes and planning. "
    "Answer concisely and practically, grounded in the user's data provided below. Use short markdown lists when helpful. "
    "Never claim you changed data; any changes are offered as proposals the user reviews separately.\n\nUSER DATA:\n"
)


class ChatTurn(BaseModel):
    role: str
    text: str


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    context: str = Field(default="", max_length=20000)
    history: list[ChatTurn] = []


@app.post("/api/ai/chat")
async def ai_chat(body: ChatRequest, request: Request):
    me = await client.get("/api/v1/auth/me", headers={"cookie": request.headers.get("cookie", "")})
    if me.status_code != 200:
        return JSONResponse({"detail": "Please sign in to use GPT 6 Luna"}, status_code=401)
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return JSONResponse({"detail": "OpenAI API key is not configured"}, status_code=503)
    chat = LlmChat(api_key=key, session_id=str(uuid.uuid4()), system_message=SYSTEM_PROMPT + body.context).with_model("openai", "gpt-6-luna")
    transcript = "\n".join(f"{t.role.upper()}: {t.text}" for t in body.history[-10:])
    text = f"Conversation so far:\n{transcript}\n\nUSER: {body.prompt}" if transcript else body.prompt

    async def events():
        try:
            async for ev in chat.stream_message(UserMessage(text=text)):
                if isinstance(ev, TextDelta):
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as exc:
            msg = str(exc)
            if "credits" in msg or "quota" in msg:
                msg = "your OpenAI account has no credits left"
            elif "RateLimit" in msg:
                msg = "OpenAI rate limit reached, try again shortly"
            elif "AuthenticationError" in msg or "API key" in msg:
                msg = "the OpenAI API key was rejected"
            else:
                msg = "the AI service failed to respond"
            yield f"data: {json.dumps({'error': msg})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(path: str, request: Request):
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP_HEADERS}
    upstream = await client.request(request.method, f"/{path}", params=request.query_params, headers=headers, content=await request.body())
    out = Response(content=upstream.content, status_code=upstream.status_code)
    for k, v in upstream.headers.multi_items():
        if k.lower() not in HOP_HEADERS:
            out.headers.append(k, v)
    return out
