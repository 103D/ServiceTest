import { useEffect, useState } from "react";
import { FiPlus, FiRefreshCw, FiTrash2 } from "react-icons/fi";
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

function getBranchIdFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return payload?.branch_id || null;
  } catch {
    return null;
  }
}

export default function EmployeesPage({ apiBaseUrl, token, notify }) {
  const [form, setForm] = useState({
    name: "",
    branch_id: "",
    branch_name: "",
    hired_at: "",
  });
  const [branches, setBranches] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const userRole = getUserRole(token);
  const managerBranchId = getBranchIdFromToken(token);

  const loadEmployees = async () => {
    setError("");
    try {
      const data = await apiRequest({
        apiBaseUrl,
        path: "/employees/",
        token,
      });
      setRows(asArray(data));
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    }
  };

  const loadBranches = async () => {
    setError("");
    try {
      const data = await apiRequest({
        apiBaseUrl,
        path: "/branches/",
        token,
      });
      const branchList = asArray(data);
      setBranches(branchList);
      if (branchList.length > 0) {
        const firstId = Number(branchList[0].id);
        if (userRole === "MANAGER") {
          setForm((prev) => ({ ...prev, branch_id: managerBranchId || firstId }));
        } else {
          setForm((prev) => ({
            ...prev,
            branch_id: prev.branch_id || firstId,
            branch_name: prev.branch_name || String(branchList[0].name || ""),
          }));
        }
      }
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    }
  };

  useEffect(() => {
    loadBranches();
    loadEmployees();
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");

    try {
      let resolvedBranchId = Number(form.branch_id);
      if (userRole === "ADMIN") {
        const normalized = form.branch_name.trim().toLowerCase();
        const matchedBranch = branches.find(
          (branch) => String(branch.name).trim().toLowerCase() === normalized,
        );
        if (!matchedBranch) {
          throw new Error("Филиал с таким названием не найден. Сначала создайте филиал.");
        }
        resolvedBranchId = Number(matchedBranch.id);
      }

      await apiRequest({
        apiBaseUrl,
        path: "/employees/",
        method: "POST",
        token,
        body: {
          name: form.name,
          branch_id: resolvedBranchId,
          hired_at: form.hired_at || null,
        },
      });
      setForm((prev) => ({ ...prev, name: "", hired_at: "" }));
      await loadEmployees();
      notify("success", "Сотрудник создан");
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    }
  };

  const handleDelete = async (employeeId) => {
    try {
      await apiRequest({
        apiBaseUrl,
        path: `/employees/${employeeId}`,
        method: "DELETE",
        token,
      });
      await loadEmployees();
      notify("success", "Сотрудник удалён");
    } catch (err) {
      notify("error", err.message);
    }
  };

  const branchById = new Map(branches.map((b) => [b.id, b.name]));

  const getEmployeeCode = (row) => {
    const sameBranch = rows
      .filter((r) => r.branch_id === row.branch_id)
      .sort((a, b) => a.id - b.id);
    const seq = sameBranch.findIndex((r) => r.id === row.id) + 1;
    return String(row.branch_id).padStart(2, "0") + String(seq).padStart(2, "0");
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Сотрудники</h2>
        <button
          type="button"
          onClick={loadEmployees}
          className="icon-btn"
          aria-label="Обновить"
          title="Обновить"
        >
          <FiRefreshCw aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleCreate} className="inline-form">
        <input
          type="text"
          placeholder="Имя сотрудника"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          required
        />
        {userRole === "ADMIN" ? (
          <>
            <input
              type="text"
              list="branch-options"
              placeholder="Название филиала"
              value={form.branch_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, branch_name: e.target.value }))
              }
              required
            />
            <datalist id="branch-options">
              {branches.map((branch) => (
                <option key={branch.id} value={branch.name} />
              ))}
            </datalist>
          </>
        ) : null}
        <input
          type="date"
          value={form.hired_at}
          onChange={(e) => setForm((prev) => ({ ...prev, hired_at: e.target.value }))}
            required
        />
        <button type="submit" className="icon-btn" aria-label="Создать" title="Создать">
          <FiPlus aria-hidden="true" />
        </button>
      </form>

      {error ? <div className="notice error">{error}</div> : null}

      {rows.length === 0 ? (
        <p className="empty">Сотрудников пока нет</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Код</th>
                <th>Имя</th>
                <th>Филиал</th>
                <th>Дата приёма</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{getEmployeeCode(row)}</td>
                  <td>{row.name}</td>
                  <td>{branchById.get(row.branch_id) || row.branch_id}</td>
                  <td>{row.hired_at || "—"}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      className="icon-btn"
                      aria-label="Удалить"
                      title="Удалить"
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
