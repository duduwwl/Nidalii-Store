"use client";

import { useActionState } from "react";
import { adminSignInAction } from "../actions/auth";
import { FormMessage, Submit, TextField } from "@/components/ui/form";

export function AdminLoginForm() {
  const [state, action] = useActionState(adminSignInAction, null);
  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <TextField name="email" type="email" label="E-mail" autoComplete="username" required />
      <TextField name="password" type="password" label="Senha" autoComplete="current-password" required />
      <Submit pendingText="Entrando…" className="btn btn-solid btn-block">Entrar</Submit>
    </form>
  );
}
