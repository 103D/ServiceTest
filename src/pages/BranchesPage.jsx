import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiEdit2, FiPlus, FiRefreshCw, FiTrash2, FiX } from "react-icons/fi";
import * as XLSX from "xlsx";
import { apiRequest } from "../api/client";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getUserRole(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return payload?.role || null;
  } catch {
    return null;
  }
}

export default function BranchesPage({ apiBaseUrl, token, notify }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("Almaty");
  const [rows, setRows] = useState([]);
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("Almaty");
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  const userRole = getUserRole(token);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (va == null) va = "";
      if (vb == null) vb = "";
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa < sb) return sortDir === "asc" ? -1 : 1;
      if (sa > sb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortDir]);

  const loadBranches = async () => {
    setError("");
    try {
      const data = await apiRequest({
        apiBaseUrl,
        path: "/branches/",
        token,
      });
      setRows(asArray(data));
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await apiRequest({
        apiBaseUrl,
        path: "/branches/",
        method: "POST",
        token,
        body: { name, city },
      });
      setName("");
      setCity("Almaty");
      await loadBranches();
      notify("success", "Филиал создан");
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    }
  };

  const startEdit = (branch) => {
    setEditingBranchId(branch.id);
    setEditName(branch.name);
    setEditCity(branch.city || "Almaty");
  };

  const cancelEdit = () => {
    setEditingBranchId(null);
    setEditName("");
    setEditCity("Almaty");
  };

  const handleUpdate = async (branchId) => {
    try {
      await apiRequest({
        apiBaseUrl,
        path: `/branches/${branchId}`,
        method: "PUT",
        token,
        body: { name: editName, city: editCity },
      });
      cancelEdit();
      await loadBranches();
      notify("success", "Филиал обновлен");
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    }
  };

  const handleDelete = async (branch) => {
    const confirmed = window.confirm(
      `Удалить филиал "${branch.name}"? Это действие нельзя отменить.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await apiRequest({
        apiBaseUrl,
        path: `/branches/${branch.id}`,
        method: "DELETE",
        token,
      });
      await loadBranches();
      notify("success", "Филиал удален");
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
        <button
          type="button"
          onClick={() => {
            if (rows.length === 0) return;
            const data = rows.map((r) => ({
              ID: r.id,
              Название: r.name,
              Город: r.city || "—",
              Сотрудники: r.employee_count ?? 0,
              "Средняя оценка": r.average_score != null ? Number(r.average_score).toFixed(1) : "—",
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Филиалы");
            XLSX.writeFile(wb, "branches.xlsx");
          }}
          style={{ backgroundColor: "#22c55e", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer"}}
        >
          Экспорт в Excel
        </button>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Филиалы</h2>
          <button
            type="button"
            onClick={loadBranches}
            className="icon-btn"
            aria-label="Обновить"
            title="Обновить"
          >
            <FiRefreshCw aria-hidden="true" />
          </button>
        </div>

        {userRole === "ADMIN" && (
        <form onSubmit={handleCreate} className="inline-form">
          <input
            type="text"
            placeholder="Название филиала"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Город"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <button type="submit" className="icon-btn" aria-label="Создать" title="Создать">
            <FiPlus aria-hidden="true" />
          </button>
        </form>
      )}

      {error ? <div className="notice error">{error}</div> : null}

      {rows.length === 0 ? (
        <p className="empty">Филиалов пока нет</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  { key: "id", label: "ID" },
                  { key: "name", label: "Название" },
                  { key: "city", label: "Город" },
                  { key: "employee_count", label: "Сотрудники" },
                  { key: "average_score", label: "Средняя оценка" },
                ].map((col) => (
                  <th
                    key={col.key}
                    className={`sortable-th${sortKey === col.key ? " sortable-th--active" : ""}`}
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.label}
                    <span className={sortKey === col.key ? "sort-icon sort-icon--active" : "sort-icon"}>
                      {sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅"}
                    </span>
                  </th>
                ))}
                {userRole === "ADMIN" ? <th>Действия</th> : null}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const isEditing = editingBranchId === row.id;
                return (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      ) : (
                        row.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                        />
                      ) : (
                        row.city || "—"
                      )}
                    </td>
                    <td>{row.employee_count ?? 0}</td>
                    <td>
                      {row.average_score != null
                        ? Number(row.average_score).toFixed(1)
                        : "—"}
                    </td>
                    {userRole === "ADMIN" ? (
                      <td>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => handleUpdate(row.id)}
                              className="icon-btn"
                              aria-label="Сохранить"
                              title="Сохранить"
                            >
                              <FiCheck aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="icon-btn"
                              aria-label="Отмена"
                              title="Отмена"
                            >
                              <FiX aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="icon-btn"
                              aria-label="Изменить"
                              title="Изменить"
                            >
                              <FiEdit2 aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              className="icon-btn"
                              aria-label="Удалить"
                              title="Удалить"
                            >
                              <FiTrash2 aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
    </>
  );
}
