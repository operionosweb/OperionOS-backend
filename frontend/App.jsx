import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const API =
    "https://operionos-backend-1.onrender.com";

  // ================================
  // AUTH STATE LISTENER
  // ================================
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });

    return () => listener.subscription.unsubscribe();
  }, []);

  // ================================
  // FETCH BACKEND (AUTHENTICATED)
  // ================================
  async function loadDecision() {
    try {
      setLoading(true);
      setError("");

      const contractId =
        "a339bfce-1c19-4fd9-bf05-130ebf1b1a7e";

      const token = session?.access_token;

      const res = await fetch(
        `${API}/api/contracts/${contractId}/decision`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          }
        }
      );

      const text = await res.text();

      if (!res.ok) {
        throw new Error(
          `Backend error ${res.status}: ${text}`
        );
      }

      const json = JSON.parse(text);
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) {
      loadDecision();
    }
  }, [session]);

  // ================================
  // LOGIN
  // ================================
  async function login() {
    const email = prompt("Email:");
    const password = prompt("Password:");

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) alert(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setData(null);
  }

  // ================================
  // UI STATES
  // ================================

  if (loading && !session) {
    return (
      <div style={{ padding: 20, background: "black", color: "white" }}>
        Loading Operion...
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: 20, background: "black", color: "white" }}>
        <h1>Operion Login</h1>
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, background: "black", color: "white" }}>
      <h1>Operion Dashboard</h1>

      <button onClick={logout}>Logout</button>
      <button onClick={loadDecision}>Refresh</button>

      {error && (
        <p style={{ color: "red" }}>{error}</p>
      )}

      <pre style={{ marginTop: 20 }}>
        {data
          ? JSON.stringify(data, null, 2)
          : "No data loaded"}
      </pre>
    </div>
  );
}
