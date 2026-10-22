import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/server/settings";
import { DEFAULT_TEXTS } from "@/server/default-texts";
import { mpConfigured } from "@/server/payments/mercadopago";
import { PageHeader, Table } from "@/components/admin/ui";
import { PaymentForm, StaffManager, StoreInfoForm, TextsForm } from "@/components/admin/settings-forms";

const dt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export default async function ConfiguracoesPage() {
  const me = await requireAdmin();
  const [s, staff, emails, logs] = await Promise.all([
    getSettings(),
    db.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] } }, include: { admin: true }, orderBy: { createdAt: "asc" } }),
    db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { actor: { include: { admin: true } } } }),
  ]);
  const mpEnv = (process.env.MP_ACCESS_TOKEN ?? "").startsWith("TEST-") ? "credenciais de teste" : "produção";

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid max-w-4xl gap-6">
        <StoreInfoForm s={{ legalName: s.legalName ?? "", cnpj: s.cnpj ?? "", whatsapp: s.whatsapp ?? "", contactEmail: s.contactEmail ?? "", instagramUrl: s.instagramUrl ?? "", announcementText: s.announcementText ?? "", logoUrl: s.logoUrl }} />
        <PaymentForm s={s} status={{ mp: mpConfigured(), webhook: !!process.env.MP_WEBHOOK_SECRET, env: mpEnv }} />
        <TextsForm
          values={{ aboutText: s.aboutText ?? "", sizeGuide: s.sizeGuide ?? "", shippingPolicy: s.shippingPolicy ?? "", returnsPolicy: s.returnsPolicy ?? "", privacyPolicy: s.privacyPolicy ?? "", termsOfUse: s.termsOfUse ?? "" }}
          defaults={DEFAULT_TEXTS}
        />
        <StaffManager staff={staff.map((u) => ({ id: u.id, email: u.email, role: u.role, name: u.admin?.displayName ?? u.email }))} me={me.id} />

        <section className="grid gap-3">
          <h2 className="text-lg font-medium">E-mails enviados</h2>
          <p className={`text-sm ${process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? "text-ok" : "text-wine"}`}>
            {process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? `Envio ativo pelo Resend (${process.env.EMAIL_FROM})` : "Envio de e-mail não configurado (RESEND_API_KEY e EMAIL_FROM). Os avisos ficam registrados abaixo, mas não chegam às clientes."}
          </p>
          {emails.length > 0 && (
            <Table><thead><tr><th>Quando</th><th>Para</th><th>Assunto</th><th>Resultado</th></tr></thead>
              <tbody>{emails.map((m) => <tr key={m.id}><td className="price">{dt.format(m.createdAt)}</td><td>{m.to}</td><td>{m.subject}</td><td className={m.status === "sent" ? "text-ok" : "text-wine"}>{m.status === "sent" ? "Enviado" : m.status === "skipped" ? "Não enviado" : "Falhou"}</td></tr>)}</tbody></Table>
          )}
        </section>

        <section className="grid gap-3">
          <h2 className="text-lg font-medium">Registro de alterações</h2>
          <Table><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th></tr></thead>
            <tbody>{logs.map((l) => <tr key={l.id}><td className="price">{dt.format(l.createdAt)}</td><td>{l.actor?.admin?.displayName ?? l.actor?.email ?? "Sistema"}</td><td className="text-graphite">{l.action}{l.entityId ? ` · ${l.entityType}` : ""}</td></tr>)}</tbody></Table>
        </section>
      </div>
    </>
  );
}
