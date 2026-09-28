"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize(options: {
        client_id: string; ux_mode: "redirect"; login_uri: string; nonce: string;
        auto_select: boolean;
      }): void;
      renderButton(element: HTMLElement, options: {
        type: "standard"; theme: "outline"; size: "large"; text: "signin_with";
      }): void;
    } } };
  }
}

export function GoogleSignIn() {
  const button = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!ready || !clientId) return;
    let cancelled = false;
    async function initialize() {
      try {
        const response = await fetch("/auth/nonce", { cache: "no-store" });
        if (!response.ok) throw new Error("Login initialization failed.");
        const { nonce } = await response.json();
        if (cancelled || !button.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId!, ux_mode: "redirect",
          login_uri: `${window.location.origin}/auth/callback`, nonce, auto_select: false,
        });
        window.google.accounts.id.renderButton(button.current, {
          type: "standard", theme: "outline", size: "large", text: "signin_with",
        });
      } catch { if (!cancelled) setError("Google sign-in could not load. Please refresh and try again."); }
    }
    void initialize();
    return () => { cancelled = true; };
  }, [ready, clientId]);

  if (!clientId) return <p role="alert">Google sign-in is not configured yet.</p>;
  return <>
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
      onReady={() => setReady(true)} onError={() => setError("Google sign-in could not load. Please refresh and try again.")} />
    <div ref={button} aria-label="Sign in with Google" />
    {!ready && !error && <p>Loading Google sign-in…</p>}
    {error && <p role="alert">{error}</p>}
  </>;
}
