import { useEffect, useMemo, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { apiRequest } from "../api/client";
import DataTable from "../components/DataTable";

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

function formatDateOnly(value) {
  if (!value) return "-";
  const text = String(value);
  if (text.includes("T")) {
    return text.split("T")[0];
  }
  if (text.includes(" ")) {
    return text.split(" ")[0];
  }
  return text;
}

export default function GradesPage({ apiBaseUrl, token, notify }) {
  const shiftRoles = ["Кассир", "Продавец", "Официант", "Бариста"];
  const userRole = getUserRole(token);
  const canModeratePending = userRole === "ADMIN";

  const [createForm, setCreateForm] = useState({
    employee_id: "",
    value: 100,
    role_in_shift: "Кассир",
    comment: "",
  });
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [rows, setRows] = useState([]);
  const [pendingGrades, setPendingGrades] = useState([]);
  const [monthlyCountsByEmployee, setMonthlyCountsByEmployee] = useState({});
  const [error, setError] = useState("");

  const columns = [
    { key: "employee_id", label: "Сотрудник" },
    ...(userRole === "ADMIN" ? [{ key: "branch", label: "Филиал" }] : []),
    { key: "value", label: "Оценка" },
    { key: "role_in_shift", label: "Роль" },
    { key: "comment", label: "Комментарий" },
    { key: "status", label: "Статус" },
    { key: "created_at", label: "Дата" },
  ];

  const loadBranches = async () => {
    try {
      const data = await apiRequest({
        apiBaseUrl,
        path: "/branches/",
      });
      setBranches(asArray(data));
    } catch {
      setBranches([]);
    }
  };

  const loadEmployees = async () => {
    setError("");
    try {
      const data = await apiRequest({
        apiBaseUrl,
        path: "/employees/",
        token,
      });
      setEmployees(asArray(data));
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    }
  };

  const loadMonthlyCounts = async () => {
    try {
      const data = await apiRequest({
        apiBaseUrl,
        path: "/grades/monthly-counts",
        token,
      });

      const nextMap = {};
      for (const item of asArray(data)) {
        nextMap[item.employee_id] = Number(item.grades_count || 0);
      }
      setMonthlyCountsByEmployee(nextMap);
    } catch (err) {
      notify("error", err.message);
      setMonthlyCountsByEmployee({});
    }
  };

  const loadByEmployee = async (id) => {
    if (!id) {
      setRows([]);
      return;
    }
    setError("");
    try {
      const data = await apiRequest({
        apiBaseUrl,
        path: `/grades/employee/${Number(id)}`,
        token,
      });
      setRows(asArray(data));
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    }
  };

  const loadPendingGrades = async () => {
    try {
      const data = await apiRequest({
        apiBaseUrl,
        path: "/grades/pending",
        token,
      });
      setPendingGrades(asArray(data));
    } catch (err) {
      notify("error", err.message);
    }
  };

  const handleApprove = async (gradeId) => {
    try {
      await apiRequest({
        apiBaseUrl,
        path: `/grades/${gradeId}/approve`,
        method: "PATCH",
        token,
      });
      notify("success", "Оценка подтверждена");
      await loadPendingGrades();
      await loadMonthlyCounts();
      if (createForm.employee_id) {
        await loadByEmployee(createForm.employee_id);
      }
    } catch (err) {
      notify("error", err.message);
    }
  };

  const handleReject = async (gradeId) => {
    try {
      await apiRequest({
        apiBaseUrl,
        path: `/grades/${gradeId}/reject`,
        method: "PATCH",
        token,
      });
      notify("success", "Оценка отклонена");
      await loadPendingGrades();
      await loadMonthlyCounts();
      if (createForm.employee_id) {
        await loadByEmployee(createForm.employee_id);
      }
    } catch (err) {
      notify("error", err.message);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");

    if (!createForm.employee_id) {
      const message = "Сначала выберите сотрудника из списка";
      setError(message);
      notify("error", message);
      return;
    }

    try {
      await apiRequest({
        apiBaseUrl,
        path: "/grades/",
        method: "POST",
        token,
        body: {
          employee_id: Number(createForm.employee_id),
          value: Number(createForm.value),
          role_in_shift: createForm.role_in_shift,
          comment: createForm.comment || null,
        },
      });
      setCreateForm((prev) => ({ ...prev, value: 100, comment: "" }));
      await loadMonthlyCounts();
      await loadByEmployee(createForm.employee_id);
      await loadPendingGrades();
      notify("success", userRole === "ADMIN" ? "Оценка добавлена" : "Оценка отправлена на подтверждение");
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadBranches();
    loadPendingGrades();
    loadMonthlyCounts();
  }, []);

  const sortedEmployees = useMemo(() => {
    const byName = (name) => String(name || "").toLocaleLowerCase("ru");
    return [...employees].sort((left, right) => {
      const leftCount = Number(monthlyCountsByEmployee[left.id] || 0);
      const rightCount = Number(monthlyCountsByEmployee[right.id] || 0);
      if (leftCount !== rightCount) {
        return leftCount - rightCount;
      }
      return byName(left.name).localeCompare(byName(right.name));
    });
  }, [employees, monthlyCountsByEmployee]);

  const underRatedEmployees = useMemo(
    () =>
      sortedEmployees.filter(
        (employee) => (monthlyCountsByEmployee[employee.id] || 0) < 3,
      ),
    [sortedEmployees, monthlyCountsByEmployee],
  );

  const statusLabel = (status) => {
    if (status === "APPROVED") return "✅ Подтверждена";
    if (status === "REJECTED") return "❌ Отклонена";
    return "⏳ Ожидает";
  };

  const employeeById = new Map(employees.map((e) => [e.id, e.name]));
  const employeeBranchIdById = new Map(employees.map((e) => [e.id, e.branch_id]));
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const getBranchLabel = (employeeId) => {
    const branchId = employeeBranchIdById.get(employeeId);
    if (!branchId) return "—";
    return branchNameById.get(branchId) || `#${branchId}`;
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Оценки</h2>
      </div>

      <form onSubmit={handleCreate} className="inline-form wrap">
        <select
          value={createForm.employee_id}
          onChange={(e) => {
            const id = Number(e.target.value);
            setCreateForm((prev) => ({ ...prev, employee_id: id }));
            loadByEmployee(id);
          }}
          required
        >
          <option value="" disabled>
            {employees.length === 0 ? "Нет сотрудников" : "Выберите сотрудника"}
          </option>
          {sortedEmployees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} ({monthlyCountsByEmployee[employee.id] || 0}/3 за месяц)
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          max="100"
          placeholder="Оценка"
          value={createForm.value}
          onChange={(e) =>
            setCreateForm((prev) => ({ ...prev, value: e.target.value }))
          }
          required
        />
        <select
          value={createForm.role_in_shift}
          onChange={(e) =>
            setCreateForm((prev) => ({ ...prev, role_in_shift: e.target.value }))
          }
          required
        >
          {shiftRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Комментарий"
          value={createForm.comment}
          onChange={(e) =>
            setCreateForm((prev) => ({ ...prev, comment: e.target.value }))
          }
        />
        <button
          type="submit"
          className="icon-btn"
          aria-label="Добавить оценку"
          title="Добавить оценку"
        >
          <FiPlus aria-hidden="true" />
        </button>
      </form>

      {error ? <div className="notice error">{error}</div> : null}

      {(userRole === "ADMIN" || pendingGrades.length > 0) && (
        <div style={{ marginTop: "1rem" }}>
          <h3>{userRole === "ADMIN" ? "Ожидают подтверждения" : "Ваши оценки на рассмотрении"}</h3>
          {pendingGrades.length === 0 ? (
            <p className="empty">Нет оценок на рассмотрении</p>
          ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  {userRole === "ADMIN" ? <th>Филиал</th> : null}
                  <th>Оценка</th>
                  <th>Роль</th>
                  <th>Комментарий</th>
                  <th>Дата</th>
                  {canModeratePending ? <th title="Подтвердить">✅</th> : null}
                  {canModeratePending ? <th title="Отклонить">🗑</th> : null}
                </tr>
              </thead>
              <tbody>
                {pendingGrades.map((grade) => (
                  <tr key={grade.id}>
                    <td>{employeeById.get(grade.employee_id) || grade.employee_id}</td>
                    {userRole === "ADMIN" ? <td>{getBranchLabel(grade.employee_id)}</td> : null}
                    <td>{grade.value}</td>
                    <td>{grade.role_in_shift}</td>
                    <td>{grade.comment || "—"}</td>
                    <td>{formatDateOnly(grade.created_at)}</td>
                    {canModeratePending ? (
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="radio"
                          name={`grade-${grade.id}`}
                          title="Подтвердить"
                          onChange={() => handleApprove(grade.id)}
                        />
                      </td>
                    ) : null}
                    {canModeratePending ? (
                      <td style={{ textAlign: "center" }}>
                        <span
                          role="button"
                          title="Отклонить"
                          style={{ cursor: "pointer", fontSize: "1.1rem" }}
                          onClick={() => handleReject(grade.id)}
                        >
                          🗑
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      <div style={{ marginTop: "1rem" }}>
        <h3>История оценок</h3>
        <select
          value={createForm.employee_id}
          onChange={(e) => {
            const id = Number(e.target.value);
            setCreateForm((prev) => ({ ...prev, employee_id: id }));
            loadByEmployee(id);
          }}
          style={{ marginBottom: "0.5rem" }}
        >
          <option value="" disabled>
            {employees.length === 0 ? "Нет сотрудников" : "Выберите сотрудника"}
          </option>
          {sortedEmployees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} ({monthlyCountsByEmployee[employee.id] || 0}/3 за месяц)
            </option>
          ))}
        </select>
        <DataTable
          columns={columns}
          rows={rows.map((r) => ({
            ...r,
            branch: getBranchLabel(r.employee_id),
            status: statusLabel(r.status),
            created_at: formatDateOnly(r.created_at),
          }))}
          emptyText="Оценок пока нет"
        />
      </div>

      <div className="monthly-focus-block">
        <h3>Нужно дооценить в этом месяце</h3>
        {underRatedEmployees.length === 0 ? (
          <p className="empty">Все сотрудники уже имеют 3+ оценок за месяц.</p>
        ) : (
          <div className="monthly-focus-list">
            {underRatedEmployees.map((employee) => {
              const count = Number(monthlyCountsByEmployee[employee.id] || 0);
              return (
                <button
                  key={employee.id}
                  type="button"
                  className="monthly-focus-item"
                  onClick={() => {
                    setCreateForm((prev) => ({ ...prev, employee_id: employee.id }));
                    loadByEmployee(employee.id);
                  }}
                >
                  <span>{employee.name}</span>
                  <strong>{count}/3</strong>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
