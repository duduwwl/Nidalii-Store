"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestResetAction, resetPasswordAction, signInAction, signUpAction } from "@/app/actions/account";
import { FormMessage, Submit, TextField } from "../ui/form";

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, null);
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="voltar" value={next} />
      <FormMessage state={state} />
      <TextField name="email" type="email" label="E-mail" autoComplete="email" required inputMode="email" />
      <TextField name="password" type="password" label="Senha" autoComplete="current-password" required />
      <Link href="/recuperar-senha" className="-mt-2 w-fit text-sm underline underline-offset-4">Esqueci minha senha</Link>
      <Submit pendingText="Entrando…">Entrar</Submit>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUpAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="voltar" value={next} />
      <FormMessage state={state && !state.fieldErrors ? state : null} />
      <TextField name="fullName" label="Nome completo" autoComplete="name" required error={fe.fullName} />
      <TextField name="email" type="email" label="E-mail" autoComplete="email" required inputMode="email" error={fe.email} />
      <TextField name="password" type="password" label="Senha" autoComplete="new-password" required minLength={8} error={fe.password} hint="Pelo menos 8 caracteres." />
      <label className="check text-sm"><input type="checkbox" name="marketing" /><span>Quero receber novidades e promoções por e-mail.</span></label>
      <label className="check text-sm">
        <input type="checkbox" name="terms" required aria-invalid={!!fe.terms} />
        <span>Li e aceito os <Link href="/termos-de-uso" className="link" target="_blank">termos de uso</Link> e a <Link href="/politica-de-privacidade" className="link" target="_blank">política de privacidade</Link>.</span>
      </label>
      {fe.terms && <p className="error" role="alert">{fe.terms}</p>}
      <Submit pendingText="Criando conta…">Criar conta</Submit>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestResetAction, null);
  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <TextField name="email" type="email" label="E-mail da conta" autoComplete="email" required error={state?.fieldErrors?.email} />
      <Submit pendingText="Enviando…">Enviar link</Submit>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  if (state?.ok) {
    return (
      <div className="grid gap-5">
        <FormMessage state={state} />
        <Link href="/entrar" className="btn btn-solid w-fit">Entrar</Link>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <TextField name="password" type="password" label="Nova senha" autoComplete="new-password" required minLength={8} error={state?.fieldErrors?.password} hint="Pelo menos 8 caracteres." />
      <Submit pendingText="Salvando…">Salvar nova senha</Submit>
    </form>
  );
}
