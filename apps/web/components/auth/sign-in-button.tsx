"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { GithubMark } from "./github-mark";

export function SignInButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.signIn.social({
          provider: "github",
          callbackURL: "/",
          errorCallbackURL: "/login",
        });
        // On success the browser is already navigating to GitHub.
        if (error) setPending(false);
      }}
      className="console-button console-button-primary inline-flex w-full items-center justify-center gap-3 sm:w-auto"
    >
      <GithubMark className="size-4" />
      {pending ? "Conectando con GitHub…" : "Entrar con GitHub"}
    </button>
  );
}
