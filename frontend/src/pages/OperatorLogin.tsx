import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export function OperatorLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError("Credenciales invalidas");
      return;
    }
    navigate("/operador");
  }

  return (
    <div style={{ maxWidth: 340, margin: "80px auto", background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <p style={{ fontWeight: 500, fontSize: 16, marginBottom: 16 }}>Acceso operador</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginBottom: 12 }}
        />
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", marginBottom: 16 }}
        />
        {error && <p style={{ fontSize: 13, color: "var(--danger-text)", marginBottom: 12 }}>{error}</p>}
        <button type="submit" className="primary" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
