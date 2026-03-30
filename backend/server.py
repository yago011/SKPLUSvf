import os
import uuid
import secrets
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "skplus_saas")
JWT_SECRET = os.environ.get("JWT_SECRET", "skplus-pro-saas-secret-key-2024")
JWT_ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

mongo_client: AsyncIOMotorClient = None
db = None

# ─────────────────────────────────────────────
# LIFESPAN
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(application: FastAPI):
    global mongo_client, db
    mongo_client = AsyncIOMotorClient(MONGO_URL)
    db = mongo_client[DB_NAME]

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True, sparse=True)
    await db.users.create_index("chave_extensao", sparse=True)
    await db.contas_skokka.create_index("id", unique=True, sparse=True)
    await db.tarefas.create_index("id", unique=True, sparse=True)
    await db.tarefas.create_index([("status", 1), ("conta_id", 1)])
    await db.modelos_cache.create_index([("modelo", 1), ("conta_id", 1)], unique=True)
    await db.logs_atividade.create_index([("created_at", -1)])

    # Seed admin user
    existing = await db.users.find_one({"email": "admin@skplus.com.br"})
    if not existing:
        await db.users.insert_one({
            "id": "admin-001",
            "nome": "Yago",
            "email": "admin@skplus.com.br",
            "senha_hash": pwd_context.hash("admin123"),
            "role": "admin",
            "chave_extensao": None,
            "ativo": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })

    yield
    mongo_client.close()

# ─────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────
app = FastAPI(title="SK+ PRO SaaS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def make_token(payload: dict, expire_hours: int = 24) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(hours=expire_hours)
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)

def serialize(doc: dict) -> dict:
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            continue
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["id"]})
        if not user or not user.get("ativo"):
            raise HTTPException(status_code=401, detail="Sessão inválida ou conta inativa")
        return {"id": user["id"], "nome": user["nome"], "email": user.get("email", ""), "role": user["role"]}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")

async def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    return user

# ─────────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────────
@app.get("/health")
@app.get("/api/health")
async def health():
    return {"ok": True, "ts": datetime.now(timezone.utc).isoformat()}

# ─────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────
class LoginBody(BaseModel):
    email: str
    senha: str

class ExtensaoBody(BaseModel):
    chave: str

@app.post("/api/auth/login")
async def login(body: LoginBody):
    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    if not user.get("ativo"):
        raise HTTPException(status_code=403, detail="Conta desativada")
    if not pwd_context.verify(body.senha, user["senha_hash"]):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    token = make_token({"id": user["id"], "nome": user["nome"], "email": user.get("email", ""), "role": user["role"]})
    return {"token": token, "user": {"id": user["id"], "nome": user["nome"], "email": user.get("email", ""), "role": user["role"]}}

@app.post("/api/auth/extensao")
async def login_extensao(body: ExtensaoBody):
    user = await db.users.find_one({"chave_extensao": body.chave})
    if not user:
        raise HTTPException(status_code=401, detail="Chave de acesso inválida")
    if not user.get("ativo"):
        raise HTTPException(status_code=403, detail="Conta desativada")
    token = make_token({"id": user["id"], "nome": user["nome"], "email": user.get("email", ""), "role": user["role"]}, expire_hours=168)
    contas = await db.contas_skokka.find({"lider_id": user["id"], "ativa": True}).to_list(None)
    return {
        "token": token,
        "user": {"id": user["id"], "nome": user["nome"], "role": user["role"]},
        "contas": [{"id": c["id"], "label": c["label"]} for c in contas],
    }

@app.get("/api/auth/me")
async def me(user: dict = Depends(get_current_user)):
    doc = await db.users.find_one({"id": user["id"]})
    return serialize({k: v for k, v in doc.items() if k != "senha_hash"})

# ─────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────
class CreateUserBody(BaseModel):
    nome: str
    email: str
    senha: Optional[str] = "lider123"

class UpdateUserBody(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None

@app.get("/api/users")
async def list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find().sort("created_at", -1).to_list(None)
    return [serialize({k: v for k, v in u.items() if k != "senha_hash"}) for u in users]

@app.post("/api/users", status_code=201)
async def create_user(body: CreateUserBody, admin: dict = Depends(require_admin)):
    if await db.users.find_one({"email": body.email}):
        raise HTTPException(status_code=409, detail="Email já cadastrado")
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "nome": body.nome,
        "email": body.email,
        "senha_hash": pwd_context.hash(body.senha or "lider123"),
        "role": "lider",
        "chave_extensao": secrets.token_hex(32),
        "ativo": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(doc)
    return serialize({k: v for k, v in doc.items() if k != "senha_hash" and k != "_id"})

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, body: UpdateUserBody, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    update = {"updated_at": datetime.now(timezone.utc)}
    if body.nome: update["nome"] = body.nome
    if body.email: update["email"] = body.email
    await db.users.update_one({"id": user_id}, {"$set": update})
    updated = await db.users.find_one({"id": user_id})
    return serialize({k: v for k, v in updated.items() if k != "senha_hash"})

@app.post("/api/users/{user_id}/deactivate")
async def deactivate_user(user_id: str, admin: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"ativo": False, "updated_at": datetime.now(timezone.utc)}})
    return {"id": user_id, "ativo": False}

@app.post("/api/users/{user_id}/activate")
async def activate_user(user_id: str, admin: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"ativo": True, "updated_at": datetime.now(timezone.utc)}})
    return {"id": user_id, "ativo": True}

@app.post("/api/users/{user_id}/reset-key")
async def reset_key(user_id: str, admin: dict = Depends(require_admin)):
    chave = secrets.token_hex(32)
    await db.users.update_one({"id": user_id}, {"$set": {"chave_extensao": chave, "updated_at": datetime.now(timezone.utc)}})
    return {"id": user_id, "chave_extensao": chave}

# ─────────────────────────────────────────────
# CONTAS
# ─────────────────────────────────────────────
class CreateContaBody(BaseModel):
    id: str
    label: str
    lider_id: Optional[str] = None

class UpdateContaBody(BaseModel):
    label: Optional[str] = None
    lider_id: Optional[str] = None

@app.get("/api/contas")
async def list_contas(user: dict = Depends(get_current_user)):
    if user["role"] == "admin":
        contas = await db.contas_skokka.find().sort("created_at", -1).to_list(None)
        result = []
        for c in contas:
            doc = serialize(c)
            if c.get("lider_id"):
                lider = await db.users.find_one({"id": c["lider_id"]})
                doc["lider_nome"] = lider["nome"] if lider else None
            result.append(doc)
        return result
    else:
        contas = await db.contas_skokka.find({"lider_id": user["id"], "ativa": True}).to_list(None)
        return [serialize(c) for c in contas]

@app.post("/api/contas", status_code=201)
async def create_conta(body: CreateContaBody, admin: dict = Depends(require_admin)):
    if await db.contas_skokka.find_one({"id": body.id}):
        raise HTTPException(status_code=409, detail="ID já cadastrado")
    now = datetime.now(timezone.utc)
    doc = {"id": body.id, "label": body.label, "lider_id": body.lider_id, "ativa": True, "created_at": now}
    await db.contas_skokka.insert_one(doc)
    return serialize(doc)

@app.put("/api/contas/{conta_id}")
async def update_conta(conta_id: str, body: UpdateContaBody, admin: dict = Depends(require_admin)):
    conta = await db.contas_skokka.find_one({"id": conta_id})
    if not conta:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    update = {}
    if body.label is not None: update["label"] = body.label
    if body.lider_id is not None: update["lider_id"] = body.lider_id
    if update:
        await db.contas_skokka.update_one({"id": conta_id}, {"$set": update})
    updated = await db.contas_skokka.find_one({"id": conta_id})
    return serialize(updated)

@app.post("/api/contas/{conta_id}/deactivate")
async def deactivate_conta(conta_id: str, admin: dict = Depends(require_admin)):
    await db.contas_skokka.update_one({"id": conta_id}, {"$set": {"ativa": False}})
    return {"id": conta_id, "ativa": False}

# ─────────────────────────────────────────────
# MODELOS
# ─────────────────────────────────────────────
class UpsertModeloBody(BaseModel):
    modelo: str
    conta_id: str
    quantidade_anuncios: Optional[int] = 0
    numero_atual: Optional[str] = None
    numero_antigo: Optional[str] = None
    links_edicao: Optional[List[str]] = []

@app.get("/api/modelos")
async def list_modelos(conta_id: str = Query(...), user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        conta = await db.contas_skokka.find_one({"id": conta_id, "lider_id": user["id"]})
        if not conta:
            raise HTTPException(status_code=403, detail="Acesso negado a esta conta")
    modelos = await db.modelos_cache.find({"conta_id": conta_id}).sort("modelo", 1).to_list(None)
    return [serialize(m) for m in modelos]

@app.get("/api/modelos/{modelo}")
async def get_modelo(modelo: str, conta_id: str = Query(...), user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        conta = await db.contas_skokka.find_one({"id": conta_id, "lider_id": user["id"]})
        if not conta:
            raise HTTPException(status_code=403, detail="Acesso negado a esta conta")
    doc = await db.modelos_cache.find_one({"modelo": modelo, "conta_id": conta_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Modelo não encontrado")
    return serialize(doc)

@app.post("/api/modelos")
async def upsert_modelo(body: UpsertModeloBody, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    existing = await db.modelos_cache.find_one({"modelo": body.modelo, "conta_id": body.conta_id})
    if existing:
        update = {"quantidade_anuncios": body.quantidade_anuncios or 0, "ultima_atualizacao": now}
        if body.numero_atual is not None: update["numero_atual"] = body.numero_atual
        if body.links_edicao is not None: update["links_edicao"] = body.links_edicao
        await db.modelos_cache.update_one({"modelo": body.modelo, "conta_id": body.conta_id}, {"$set": update})
    else:
        await db.modelos_cache.insert_one({
            "modelo": body.modelo, "conta_id": body.conta_id,
            "quantidade_anuncios": body.quantidade_anuncios or 0,
            "numero_atual": body.numero_atual, "numero_antigo": body.numero_antigo,
            "links_edicao": body.links_edicao or [], "ultima_atualizacao": now,
        })
    result = await db.modelos_cache.find_one({"modelo": body.modelo, "conta_id": body.conta_id})
    return serialize(result)

# ─────────────────────────────────────────────
# TAREFAS
# ─────────────────────────────────────────────
class CreateTarefaBody(BaseModel):
    tipo: str
    modelo: str
    conta_id: str
    numero_novo: Optional[str] = None
    numero_antigo: Optional[str] = None

class UpdateStatusBody(BaseModel):
    status: str
    resultado: Optional[Any] = None

@app.get("/api/tarefas/pending")
async def get_pending(conta_id: str = Query(...), user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        conta = await db.contas_skokka.find_one({"id": conta_id, "lider_id": user["id"]})
        if not conta:
            raise HTTPException(status_code=403, detail="Acesso negado a esta conta")
    tarefa = await db.tarefas.find_one({"conta_id": conta_id, "status": "pendente"}, sort=[("created_at", 1)])
    if tarefa:
        await db.tarefas.update_one({"id": tarefa["id"]}, {"$set": {"status": "processando", "updated_at": datetime.now(timezone.utc)}})
        tarefa["status"] = "processando"
    return serialize(tarefa) if tarefa else None

@app.post("/api/tarefas", status_code=201)
async def create_tarefa(body: CreateTarefaBody, user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        conta = await db.contas_skokka.find_one({"id": body.conta_id, "lider_id": user["id"]})
        if not conta:
            raise HTTPException(status_code=403, detail="Acesso negado a esta conta")
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()), "tipo": body.tipo, "modelo": body.modelo,
        "conta_id": body.conta_id, "lider_id": user["id"], "status": "pendente",
        "numero_novo": body.numero_novo, "numero_antigo": body.numero_antigo,
        "resultado": None, "created_at": now, "updated_at": now, "completed_at": None,
    }
    await db.tarefas.insert_one(doc)
    return serialize(doc)

@app.patch("/api/tarefas/{tarefa_id}/status")
async def update_tarefa_status(tarefa_id: str, body: UpdateStatusBody, user: dict = Depends(get_current_user)):
    tarefa = await db.tarefas.find_one({"id": tarefa_id})
    if not tarefa:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    update = {"status": body.status, "updated_at": datetime.now(timezone.utc)}
    if body.resultado is not None:
        update["resultado"] = json.dumps(body.resultado) if not isinstance(body.resultado, str) else body.resultado
    if body.status in ("concluida", "erro"):
        update["completed_at"] = datetime.now(timezone.utc)
    await db.tarefas.update_one({"id": tarefa_id}, {"$set": update})
    updated = await db.tarefas.find_one({"id": tarefa_id})
    return serialize(updated)

@app.get("/api/tarefas")
async def list_tarefas(
    conta_id: Optional[str] = None,
    status: Optional[str] = None,
    lider_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(get_current_user)
):
    query = {}
    if user["role"] != "admin":
        query["lider_id"] = user["id"]
    elif lider_id:
        query["lider_id"] = lider_id
    if conta_id: query["conta_id"] = conta_id
    if status: query["status"] = status
    tarefas = await db.tarefas.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(None)
    result = []
    for t in tarefas:
        doc = serialize(t)
        lider = await db.users.find_one({"id": t.get("lider_id")})
        doc["lider_nome"] = lider["nome"] if lider else None
        result.append(doc)
    return result

# ─────────────────────────────────────────────
# LOGS
# ─────────────────────────────────────────────
class CreateLogBody(BaseModel):
    conta_id: Optional[str] = None
    acao: str
    detalhes: Optional[Any] = None

@app.post("/api/logs", status_code=201)
async def create_log(body: CreateLogBody, user: dict = Depends(get_current_user)):
    await db.logs_atividade.insert_one({
        "lider_id": user["id"], "conta_id": body.conta_id, "acao": body.acao,
        "detalhes": json.dumps(body.detalhes) if body.detalhes and not isinstance(body.detalhes, str) else body.detalhes,
        "created_at": datetime.now(timezone.utc),
    })
    return {"ok": True}

@app.get("/api/logs")
async def list_logs(
    lider_id: Optional[str] = None,
    conta_id: Optional[str] = None,
    acao: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(get_current_user)
):
    query = {}
    if user["role"] != "admin":
        query["lider_id"] = user["id"]
    elif lider_id:
        query["lider_id"] = lider_id
    if conta_id: query["conta_id"] = conta_id
    if acao: query["acao"] = {"$regex": acao, "$options": "i"}
    logs = await db.logs_atividade.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(None)
    result = []
    for l in logs:
        doc = serialize(l)
        lider = await db.users.find_one({"id": l.get("lider_id")})
        doc["lider_nome"] = lider["nome"] if lider else None
        result.append(doc)
    return result

# ─────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────
@app.get("/api/dashboard")
async def get_dashboard(user: dict = Depends(get_current_user)):
    lider_filter = {} if user["role"] == "admin" else {"lider_id": user["id"]}
    conta_filter = {} if user["role"] == "admin" else {"lider_id": user["id"]}
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    trocas_hoje = await db.tarefas.count_documents({"tipo": "trocar", "created_at": {"$gte": today_start}, **lider_filter})
    mapeamentos_hoje = await db.tarefas.count_documents({"tipo": "mapeamento", "created_at": {"$gte": today_start}, **lider_filter})
    pendentes = await db.tarefas.count_documents({"status": "pendente", **lider_filter})
    erros = await db.tarefas.count_documents({"status": "erro", **lider_filter})
    total_contas = await db.contas_skokka.count_documents({"ativa": True, **conta_filter})
    total_modelos = await db.modelos_cache.count_documents({})

    return {
        "trocas_hoje": trocas_hoje, "mapeamentos_hoje": mapeamentos_hoje,
        "tarefas_pendentes": pendentes, "tarefas_erro": erros,
        "total_contas": total_contas, "total_modelos": total_modelos,
    }
