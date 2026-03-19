import { useState } from "react";
import { FiUserPlus } from "react-icons/fi";
import { apiRequest } from "../api/client";

export default function UsersPage({ apiBaseUrl, token, notify }) {
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "MANAGER",
    branch_id: 1,
  });
  const [createdUser, setCreatedUser] = useState(null);
  const [error, setError] = useState("");

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setError("");
    setCreatedUser(null);

    try {
      const data = await apiRequest({
        apiBaseUrl,
        path: "/auth/users",
        method: "POST",
        token,
        body: {
          username: form.username,
          password: form.password,
          role: form.role,
          branch_id: Number(form.branch_id),
        },
      });
      setCreatedUser(data);
      setForm({ username: "", password: "", role: "MANAGER", branch_id: 1 });
      notify("success", "Пользователь создан");
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Пользователи (только ADMIN)</h2>
      </div>

      <form onSubmit={handleCreateUser} className="inline-form wrap">
        <input
          type="text"
          placeholder="Никнейм"
          value={form.username}
          onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
          required
          minLength={3}
        />
        <input
          type="password"
          placeholder="Пароль"
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          required
          minLength={6}
        />
        <select
          value={form.role}
          onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
        >
          <option value="MANAGER">MANAGER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <input
          type="number"
          min="1"
          placeholder="ID филиала"
          value={form.branch_id}
          onChange={(e) => setForm((prev) => ({ ...prev, branch_id: e.target.value }))}
          required
        />
        <button type="submit" className="icon-btn" aria-label="Создать пользователя" title="Создать пользователя">
          <FiUserPlus aria-hidden="true" />
        </button>
      </form>

      {error ? <div className="notice error">{error}</div> : null}

      {createdUser ? (
        <div className="notice success">
          Создан пользователь: <strong>{createdUser.username}</strong> (роль: {createdUser.role},
          филиал: {createdUser.branch_id})
        </div>
      ) : null}
    </section>
  );
}
