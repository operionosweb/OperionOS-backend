import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://YOUR_PROJECT.supabase.co",
  "YOUR_SUPABASE_ANON_KEY"
);

export default function Auth() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");

  async function handleAuth() {

    setMessage("Processing...");

    let result;

    if (mode === "signup") {
      result = await supabase.auth.signUp({
        email,
        password
      });
    } else {
      result = await supabase.auth.signInWithPassword({
        email,
        password
      });
    }

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage("Success! Redirecting...");

    window.location.href = "/";
  }

  return (
    <div style={{ padding: 40, maxWidth: 400 }}>

      <h2>🧠 Operion Access</h2>

      <p>{mode === "login" ? "Login" : "Create account"}</p>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <button onClick={handleAuth}>
        {mode === "login" ? "Login" : "Sign Up"}
      </button>

      <p style={{ marginTop: 10 }}>{message}</p>

      <button
        onClick={() =>
          setMode(mode === "login" ? "signup" : "login")
        }
        style={{ marginTop: 10 }}
      >
        Switch to {mode === "login" ? "Signup" : "Login"}
      </button>

    </div>
  );
}
