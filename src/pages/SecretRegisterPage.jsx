import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function SecretRegisterPage({ apiBaseUrl, notify }) {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    password2: "",
    role: "MANAGER",
    branch_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest({ apiBaseUrl, path: "/branches/" })
      .then((data) => setBranches(asArray(data)))
      .catch(() => {});
  }, [apiBaseUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.password2) {
      setError("Пароли не совпадают");
      return;
    }
    if (branches.length > 0 && !form.branch_id) {
      setError("Выберите филиал");
      return;
    }

    setLoading(true);
    try {
      await apiRequest({
        apiBaseUrl,
        path: "/auth/register",
        method: "POST",
        body: {
          username: form.username,
          password: form.password,
          role: form.role,
          branch_id: branches.length > 0 ? Number(form.branch_id) : 1,
        },
      });
      notify("success", "Аккаунт создан!");
      navigate("/auth");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-background" aria-hidden="true" />
      <div className="auth-overlay" aria-hidden="true" />

      <div className="auth-modal" role="dialog" aria-modal="true">
        <h1>Регистрация</h1>
        <p className="muted">Создание нового аккаунта</p>

        {error ? <div className="notice error">{error}</div> : null}

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            placeholder="Логин (email)"
            type="text"
            value={form.username}
            onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
            required
          />
          <input
            placeholder="Пароль"
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            required
            minLength={6}
          />
          <input
            placeholder="Подтвердите пароль"
            type="password"
            value={form.password2}
            onChange={(e) => setForm((p) => ({ ...p, password2: e.target.value }))}
            required
            minLength={6}
          />
          <select
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
          >
            <option value="MANAGER">Менеджер</option>
            <option value="ADMIN">Админ</option>
          </select>
          {branches.length > 0 ? (
            <select
              value={form.branch_id}
              onChange={(e) => setForm((p) => ({ ...p, branch_id: e.target.value }))}
              required
            >
              <option value="" disabled>Выберите филиал</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          ) : (
            <div className="notice">
              Филиалов пока нет. Для первого ADMIN будет автоматически создан филиал Main Branch (Almaty).
            </div>
          )}
          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? "Создаем..." : "Создать аккаунт"}
          </button>
          <button
            type="button"
            className="auth-secondary-btn"
            onClick={() => navigate("/auth")}
          >
            Назад ко входу
          </button>
        </form>
      </div>
    </div>
  );
}
