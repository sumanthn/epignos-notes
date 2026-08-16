"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const registering = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      ...(registering
        ? {
            displayName: form.get("displayName"),
            organizationName: form.get("organizationName"),
          }
        : {}),
      email: form.get("email"),
      password: form.get("password"),
    };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      router.push("/workspace");
      router.refresh();
    } catch {
      setError("EpiNote is unreachable. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {registering && (
        <>
          <label>
            Your name
            <input
              name="displayName"
              type="text"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
              autoFocus
            />
          </label>
          <label>
            Organization name
            <input
              name="organizationName"
              type="text"
              autoComplete="organization"
              minLength={2}
              maxLength={100}
              required
            />
          </label>
        </>
      )}
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          autoFocus={!registering}
        />
      </label>
      <label>
        Password
        <span className="password-field">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={registering ? 12 : undefined}
            maxLength={128}
            required
          />
          <button
            className="password-toggle"
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      {registering && <p className="field-help">Use at least 12 characters. Passphrases work well.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button auth-submit" type="submit" disabled={submitting}>
        {submitting ? "Please wait…" : registering ? "Create account" : "Sign in"}
      </button>
      <p className="auth-switch">
        {registering ? "Already have an account?" : "New to EpiNote?"}{" "}
        <Link href={registering ? "/login" : "/register"}>
          {registering ? "Sign in" : "Create account"}
        </Link>
      </p>
    </form>
  );
}
