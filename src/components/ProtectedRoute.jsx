import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ token, children }) {
  if (!isTokenUsable(token)) {
    localStorage.removeItem("accessToken");
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function isTokenUsable(token) {
  if (!token) {
    return false;
  }

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) {
      return false;
    }

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(""),
    );
    const payload = JSON.parse(json);

    if (!payload?.exp) {
      return true;
    }

    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
