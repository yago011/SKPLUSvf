import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# ─── Health ───
class TestHealth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/health")
        assert r.status_code == 200
        assert r.json().get("ok") is True

# ─── Auth ───
class TestAuth:
    def test_login_valid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@skplus.com.br", "senha": "admin123"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "wrong@test.com", "senha": "wrong"})
        assert r.status_code == 401

    def test_extensao_invalid_key(self):
        r = requests.post(f"{BASE_URL}/api/auth/extensao", json={"chave": "invalidkey123"})
        assert r.status_code == 401

    def test_me(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "admin@skplus.com.br"

# ─── Dashboard ───
class TestDashboard:
    def test_dashboard_metrics(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        for key in ["trocas_hoje", "mapeamentos_hoje", "tarefas_pendentes", "tarefas_erro", "total_contas", "total_modelos"]:
            assert key in data, f"Missing key: {key}"

# ─── Users ───
class TestUsers:
    created_id = None

    def test_list_users(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_user(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/users",
            json={"nome": "TEST_Lider", "email": "test_lider_unique@skplus.com.br", "senha": "teste123"},
            headers={"Authorization": f"Bearer {admin_token}"})
        # Could be 201 or 409 if already exists
        assert r.status_code in [201, 409]
        if r.status_code == 201:
            TestUsers.created_id = r.json()["id"]

    def test_list_users_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/users")
        assert r.status_code == 403

# ─── Contas ───
class TestContas:
    def test_list_contas(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/contas", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_conta(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/contas",
            json={"id": "TEST_CONTA_001", "label": "TEST Conta"},
            headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code in [201, 409]

# ─── Tarefas ───
class TestTarefas:
    def test_list_tarefas(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/tarefas", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

# ─── Logs ───
class TestLogs:
    def test_list_logs(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/logs", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

# ─── Fixtures ───
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@skplus.com.br", "senha": "admin123"})
    if r.status_code == 200:
        return r.json()["token"]
    pytest.skip("Could not authenticate as admin")
