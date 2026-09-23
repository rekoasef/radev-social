import { isOperator } from "@radev/core";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Tally } from "@/components/console/tally";
import { allowedEmails, auth, NOT_ALLOWED } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrar · RAdev Social" };

const errors: Record<string, string> = {
  [NOT_ALLOWED]:
    "Esa cuenta de GitHub no tiene acceso a este panel. Entrá con la cuenta del operador.",
  access_denied: "Cancelaste el acceso en GitHub. Probá de nuevo cuando quieras.",
};
const fallbackError = "No se pudo completar el ingreso con GitHub. Probá de nuevo.";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const current = await auth.api.getSession({ headers: await headers() });
  if (current && isOperator(current.user, allowedEmails)) redirect("/");

  const { error } = await searchParams;
  // A live session whose email left the allowlist lands here too: show it as denied.
  const code = typeof error === "string" ? error : current ? NOT_ALLOWED : undefined;

  return (
    <main className="relative flex flex-1 flex-col">
      <div className="login-field" aria-hidden="true" />
      <div className="relative mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-4 py-16 sm:px-8">
        <div className="flex max-w-xl flex-col gap-8">
          {code ? (
            <Tally state="live">Acceso denegado</Tally>
          ) : (
            <Tally state="standby">Fuera del aire</Tally>
          )}

          <div className="flex flex-col gap-4">
            <h1 className="text-5xl font-semibold tracking-[-0.035em] text-ink sm:text-6xl">
              RAdev Social
            </h1>
            <p className="max-w-[46ch] text-base text-ink-dim">
              La sala de control de tus canales. Solo entra el operador, con su cuenta de GitHub.
            </p>
          </div>

          {code && (
            <p
              role="alert"
              className="max-w-[52ch] border-l border-tally-red pl-4 text-sm text-ink"
            >
              {errors[code] ?? fallbackError}
            </p>
          )}

          <div>
            <SignInButton />
          </div>
        </div>
      </div>
    </main>
  );
}
