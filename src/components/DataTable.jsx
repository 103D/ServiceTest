export default function DataTable({ columns, rows, emptyText = "Нет данных" }) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  if (!safeRows.length || !safeColumns.length) {
    return <p className="empty">{emptyText}</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {safeColumns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {safeRows.map((row, index) => (
            <tr key={row.id ?? index}>
              {safeColumns.map((col) => (
                <td key={col.key}>{formatValue(row[col.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}
