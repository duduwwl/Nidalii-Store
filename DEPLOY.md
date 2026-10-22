# Implantação e integrações

## 1. Onde hospedar

O site precisa de um servidor Node.js, um banco PostgreSQL e uma pasta persistente para as fotos enviadas pelo painel. **Hospedagem comum de envio de arquivos (cPanel e similares) não serve.**

| Opção | Bom para | Observação |
|---|---|---|
| **VPS** (Hetzner, DigitalOcean, Contabo, Magalu Cloud) com Node + Postgres | Recomendado. Custo fixo baixo, tudo num lugar | As fotos ficam no disco (`STORAGE_DIR`). Use Nginx + PM2 ou Docker |
| **Railway / Render** com volume persistente | Menos manutenção | Monte um volume e aponte `STORAGE_DIR` para ele |
| **Vercel + Neon/Supabase + Vercel Blob** | Escala automática | Compatível com o projeto: conecte o banco e o Blob Store antes da primeira publicação |

Passos em qualquer servidor:

```bash
npm ci
npm run db:migrate
npm run db:seed
ADMIN_PASSWORD='...' npm run admin:create -- email@da-loja.com "Nome"
npm run build
npm start          # porta 3000; coloque atrás de HTTPS
```

## 2. Variáveis de ambiente

Veja `.env.example`. Obrigatórias: `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL` (com https), `ORDER_LINK_SECRET` e `CRON_SECRET`. Gere os dois segredos com `openssl rand -base64 32`.

Na Vercel, conecte um banco PostgreSQL pelo Marketplace (Neon ou Supabase) e um Vercel Blob Store. O projeto usa `DATABASE_URL` para o Prisma e detecta automaticamente `BLOB_READ_WRITE_TOKEN` para manter as fotos persistentes.

## 3. Mercado Pago (Pix, crédito e débito)

1. Em mercadopago.com.br/developers, crie uma aplicação em **Suas integrações**, do tipo pagamentos online, checkout transparente.
2. Em **Credenciais de teste**, copie o Access Token para `MP_ACCESS_TOKEN` e a Public Key para `NEXT_PUBLIC_MP_PUBLIC_KEY`.
3. Em **Webhooks**, cadastre `https://SEU_DOMINIO/api/webhooks/mercadopago` no evento **Pagamentos**. Copie a **assinatura secreta** para `MP_WEBHOOK_SECRET`.
4. Pix: a conta precisa ter uma chave Pix cadastrada no Mercado Pago.
5. Teste com os cartões e usuários de teste do Mercado Pago, incluindo aprovado, recusado e pendente.
6. Para vender de verdade, troque pelas **credenciais de produção** e refaça o cadastro do webhook no modo produção.

O parcelamento e as parcelas sem juros são configurados em Painel › Configurações e precisam bater com o que está ativo na sua conta do Mercado Pago.

**Débito:** a disponibilidade de cartão de débito no checkout transparente depende da conta e dos bancos. O formulário só mostra o débito quando o Mercado Pago o oferece. Confirme no ambiente de testes antes de anunciar.

## 4. Melhor Envio (frete)

1. Crie a conta em melhorenvio.com.br (use primeiro o sandbox: sandbox.melhorenvio.com.br).
2. Em **Integrações › Permissões de acesso**, gere um token com o escopo de cálculo de frete (`shipping-calculate`).
3. Defina `MELHOR_ENVIO_TOKEN`, `MELHOR_ENVIO_ENV` (`sandbox` ou `production`) e `MELHOR_ENVIO_CONTACT_EMAIL`.
4. No painel, em **Frete e retirada**: informe o CEP de origem, marque os serviços, preencha a embalagem padrão e salve.
5. Em cada produto, informe peso e medidas (ou deixe valer a embalagem padrão).

A compra da etiqueta continua no painel do Melhor Envio. Depois de postar, informe o código de rastreio no pedido, em Painel › Pedidos.

## 5. E-mails (Resend)

1. Crie a conta em resend.com e verifique o domínio da loja.
2. Defina `RESEND_API_KEY` e `EMAIL_FROM` (ex.: `Nidalii Store <pedidos@seudominio.com.br>`).

Sem isso, os avisos de pedido ficam registrados em Painel › Configurações, mas não chegam às clientes.

## 6. Tarefa agendada

A cada 5 a 10 minutos, chame:

```
GET https://SEU_DOMINIO/api/cron/reservas
Authorization: Bearer SEU_CRON_SECRET
```

Ela cancela pedidos não pagos no prazo e devolve as peças ao estoque. Pode ser um cron do servidor (`curl`), o Cron Jobs da Vercel ou um serviço como cron-job.org.

## 7. Antes de abrir a loja

- [ ] Logo, razão social, CNPJ, WhatsApp e e-mail em Painel › Configurações
- [ ] Endereço da loja e horários em Frete e retirada; ligar a retirada
- [ ] Revisar os textos de Trocas, Privacidade e Termos (os padrões descrevem o sistema e a lei, não as regras comerciais da loja)
- [ ] Guia de medidas
- [ ] Categorias, coleções e produtos com fotos, preços, variantes e estoque
- [ ] Banner principal da home
- [ ] Uma compra de teste completa com Pix e com cartão no ambiente de testes
- [ ] Credenciais de produção do Mercado Pago e do Melhor Envio
- [ ] Backup automático diário do banco e da pasta de fotos
