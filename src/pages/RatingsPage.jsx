import { useEffect, useMemo, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import * as XLSX from "xlsx";
import { apiRequest } from "../api/client";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function RatingsPage({ apiBaseUrl, token, notify }) {
  const [rows, setRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadRatings = async () => {
    setError("");
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (periodFilter !== "ALL") {
        params.set("period", periodFilter.toLowerCase());
      }
      if (periodFilter === "CUSTOM") {
        if (!dateFrom || !dateTo) {
          setRows([]);
          setError("Для произвольного диапазона выберите обе даты");
          setIsLoading(false);
          return;
        }
        params.set("date_from", dateFrom);
        params.set("date_to", dateTo);
      }

      const ratingsPath = params.toString()
        ? `/ratings/all?${params.toString()}`
        : "/ratings/all";

      const [ratingsRaw, employeesRaw, branchesRaw] = await Promise.all([
        apiRequest({
          apiBaseUrl,
          path: ratingsPath,
          token,
        }),
        apiRequest({
          apiBaseUrl,
          path: "/employees/",
          token,
        }),
        apiRequest({
          apiBaseUrl,
          path: "/branches/",
          token,
        }),
      ]);

      const ratingsData = asArray(ratingsRaw);
      const employeesData = asArray(employeesRaw);
      const branchesData = asArray(branchesRaw);

      const employeeById = new Map(
        employeesData.map((employee) => [employee.id, employee]),
      );
      const branchById = new Map(
        branchesData.map((branch) => [branch.id, branch]),
      );

      const mergedRows = ratingsData.map((item) => {
        const employee = employeeById.get(item.employee_id);
        const branch = branchById.get(employee?.branch_id);
        const branchName = branch?.name || "Без филиала";
        const city = branch?.city || "Не указан";

        return {
          ...item,
          average_score: Number(item.average_score || 0),
          branch_id: employee?.branch_id ?? null,
          branch_name: branchName,
          city,
        };
      });

      const sortedRows = [...mergedRows].sort(
        (a, b) => b.average_score - a.average_score,
      );

      setRows(sortedRows);
      notify("success", "Рейтинг сотрудников загружен");
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRatings();
  }, [periodFilter, dateFrom, dateTo]);

  const cityOptions = useMemo(() => {
    return [
      "ALL",
      ...new Set(
        rows.map((row) => row.city).filter((city) => city && city !== "Не указан"),
      ),
    ];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const cityMatches = cityFilter === "ALL" || row.city === cityFilter;
      const branchMatches =
        branchFilter === "ALL" || String(row.branch_id) === branchFilter;
      const searchMatches =
        normalizedSearch.length === 0 ||
        row.employee_name?.toLowerCase().includes(normalizedSearch) ||
        row.branch_name?.toLowerCase().includes(normalizedSearch) ||
        row.city?.toLowerCase().includes(normalizedSearch);

      return cityMatches && branchMatches && searchMatches;
    });
  }, [rows, cityFilter, branchFilter, searchQuery]);

  const branchOptions = useMemo(() => {
    return [
      { value: "ALL", label: "Все филиалы" },
      ...rows
        .filter((row) => cityFilter === "ALL" || row.city === cityFilter)
        .reduce((accumulator, row) => {
          if (!row.branch_id) {
            return accumulator;
          }
          const alreadyExists = accumulator.some(
            (option) => option.value === String(row.branch_id),
          );
          if (!alreadyExists) {
            accumulator.push({
              value: String(row.branch_id),
              label: row.branch_name,
            });
          }
          return accumulator;
        }, []),
    ];
  }, [rows, cityFilter]);

  const topFive = filteredRows.slice(0, 5);
  const remainingRows = filteredRows.slice(5);

  const rankByEmployeeId = useMemo(() => {
    const ranks = new Map();
    rows.forEach((row, index) => {
      ranks.set(row.employee_id, index + 1);
    });
    return ranks;
  }, [rows]);

  useEffect(() => {
    if (
      branchFilter !== "ALL" &&
      !branchOptions.some((option) => option.value === branchFilter)
    ) {
      setBranchFilter("ALL");
    }
  }, [branchFilter, branchOptions]);

  return (
    <section className="rating-page">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
        <button
          type="button"
          onClick={() => {
            if (filteredRows.length === 0) return;
            const data = filteredRows.map((r, i) => ({
              Место: rankByEmployeeId.get(r.employee_id) || i + 1,
              Сотрудник: r.employee_name,
              Город: r.city,
              Филиал: r.branch_name,
              "Средний балл": r.average_score.toFixed(2),
              "Кол-во оценок": r.total_grades,
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Рейтинг");
            XLSX.writeFile(wb, "ratings.xlsx");
          }}
          style={{ backgroundColor: "#22c55e", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }}
        >
          Экспорт в Excel
        </button>
      </div>
      <div className="panel rating-main-panel">
        <div className="panel-head">
          <h2>Рейтинг сотрудников</h2>
          <button
            type="button"
            onClick={loadRatings}
            className="icon-btn"
            aria-label="Обновить"
            title="Обновить"
          >
            <FiRefreshCw aria-hidden="true" />
          </button>
        </div>

        {error ? <div className="notice error">{error}</div> : null}

        <div className="rating-podium">
          {topFive.length === 0 ? (
            <p className="empty">Нет данных рейтинга</p>
          ) : (
            topFive.map((row, index) => (
              <article
                key={row.employee_id}
                className={`podium-card podium-place-${index + 1}`}
              >
                <p className="podium-rank">#{rankByEmployeeId.get(row.employee_id) || "-"}</p>
                <h3>{row.employee_name}</h3>
                <p className="podium-meta">
                  {row.branch_name} · {row.city}
                </p>
                <p className="podium-score">{row.average_score.toFixed(2)}</p>
              </article>
            ))
          )}
        </div>

        <div className="rating-filters">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск: сотрудник, филиал, город"
            aria-label="Поиск в рейтинге"
            title="Поиск в рейтинге"
          />

          <select
            value={cityFilter}
            onChange={(event) => {
              setCityFilter(event.target.value);
              setBranchFilter("ALL");
            }}
          >
            <option value="ALL">Все города</option>
            {cityOptions
              .filter((city) => city !== "ALL")
              .map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
          </select>

          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
          >
            {branchOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value)}
            aria-label="Фильтр по периоду"
            title="Фильтр по периоду"
          >
            <option value="WEEK">На этой неделе</option>
            <option value="YESTERDAY">Вчера</option>
            <option value="MONTH">В этом месяце</option>
            <option value="YEAR">В этом году</option>
            <option value="ALL">За все время</option>
            <option value="CUSTOM">За промежуток времени</option>
          </select>

          {periodFilter === "CUSTOM" ? (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                aria-label="Дата начала"
                title="Дата начала"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                aria-label="Дата окончания"
                title="Дата окончания"
              />
            </>
          ) : null}
        </div>

        {isLoading ? <p className="empty">Загрузка...</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Место</th>
                <th>Сотрудник</th>
                <th>Город</th>
                <th>Филиал</th>
                <th>Средний балл</th>
                <th>Кол-во оценок</th>
              </tr>
            </thead>
            <tbody>
              {remainingRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <p className="empty">После топ-5 сотрудников не осталось</p>
                  </td>
                </tr>
              ) : (
                remainingRows.map((row, index) => (
                  <tr key={row.employee_id}>
                    <td>{rankByEmployeeId.get(row.employee_id) || "-"}</td>
                    <td>{row.employee_name}</td>
                    <td>{row.city}</td>
                    <td>{row.branch_name}</td>
                    <td>{row.average_score.toFixed(2)}</td>
                    <td>{row.total_grades}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
