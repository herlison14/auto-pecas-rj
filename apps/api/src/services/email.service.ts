import { prisma } from '@sellsync/database'

interface EmailPayload {
  to: string
  subject: string
  html: string
}

async function sendViaResend(apiKey: string, from: string, payload: EmailPayload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: payload.to, subject: payload.subject, html: payload.html }),
  })
  if (!res.ok) throw new Error(`Resend error: ${res.status}`)
}

function baseTemplate(title: string, body: string, ctaUrl?: string, ctaLabel?: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#F9FAFB;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB">
    <div style="background:#2563EB;padding:24px;text-align:center">
      <span style="color:#fff;font-size:20px;font-weight:800">⚡ SellSync</span>
    </div>
    <div style="padding:24px">
      <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 12px">${title}</h2>
      ${body}
      ${ctaUrl ? `<div style="margin-top:20px"><a href="${ctaUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${ctaLabel ?? 'Ver no SellSync'}</a></div>` : ''}
    </div>
    <div style="padding:16px;border-top:1px solid #F3F4F6;text-align:center">
      <p style="font-size:11px;color:#9CA3AF;margin:0">SellSync · Hub Multichannel para Marketplaces</p>
    </div>
  </div>
</body></html>`
}

/**
 * E-mail de plataforma (reset de senha): usa RESEND_API_KEY global do servidor;
 * se ausente, tenta o provedor configurado pelo tenant; se nada, lança erro
 * (o chamador registra a URL no log como fallback).
 */
export async function sendPasswordResetEmail(tenantId: string, to: string, name: string, resetUrl: string) {
  const payload: EmailPayload = {
    to,
    subject: 'Redefinição de senha — SellSync',
    html: baseTemplate(
      `Olá, ${name}`,
      `<p style="color:#374151;font-size:14px">Recebemos um pedido para redefinir a senha da sua conta.
       Clique no botão abaixo para criar uma nova senha. O link vale por 30 minutos.</p>
       <p style="color:#9CA3AF;font-size:12px">Se você não pediu a redefinição, ignore este e-mail — sua senha continua a mesma.</p>`,
      resetUrl,
      'Redefinir senha',
    ),
  }

  const globalKey = process.env.RESEND_API_KEY
  if (globalKey) {
    const from = process.env.EMAIL_FROM ?? 'SellSync <noreply@sellsync.app>'
    await sendViaResend(globalKey, from, payload)
    return
  }

  const settings = await prisma.emailSettings.findUnique({ where: { tenantId } })
  if (settings?.provider === 'resend' && settings.resendApiKey) {
    const from = `${settings.fromName ?? 'SellSync'} <${settings.fromEmail ?? 'noreply@sellsync.app'}>`
    await sendViaResend(settings.resendApiKey, from, payload)
    return
  }

  throw new Error('Nenhum provedor de e-mail configurado')
}

export async function sendEmailNotification(tenantId: string, payload: EmailPayload) {
  const settings = await prisma.emailSettings.findUnique({ where: { tenantId } })
  if (!settings) return

  const from = `${settings.fromName ?? 'SellSync'} <${settings.fromEmail ?? 'noreply@sellsync.app'}>`

  if (settings.provider === 'resend' && settings.resendApiKey) {
    await sendViaResend(settings.resendApiKey, from, payload)
  }
  // SMTP support can be added by installing nodemailer when needed
}

export async function notifyLowStockEmail(tenantId: string, products: Array<{ name: string; sku: string; stock: number }>) {
  const settings = await prisma.emailSettings.findUnique({ where: { tenantId } })
  if (!settings?.notifyLowStock || !settings.fromEmail) return

  const rows = products.map((p) =>
    `<tr><td style="padding:8px 12px;font-size:13px">${p.name}</td><td style="padding:8px 12px;font-family:monospace;font-size:12px">${p.sku}</td><td style="padding:8px 12px;color:#DC2626;font-weight:700">${p.stock}</td></tr>`
  ).join('')

  const body = `
    <p style="color:#374151;font-size:14px">Os seguintes produtos estão com estoque abaixo do mínimo:</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
      <thead><tr style="background:#F9FAFB"><th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280">Produto</th><th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280">SKU</th><th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280">Estoque</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`

  await sendEmailNotification(tenantId, {
    to: settings.fromEmail,
    subject: `⚠️ ${products.length} produto(s) com estoque baixo`,
    html: baseTemplate('Alerta de Estoque Baixo', body, undefined),
  })
}

export async function notifyNfeErrorEmail(tenantId: string, orderId: string, externalId: string, error: string) {
  const settings = await prisma.emailSettings.findUnique({ where: { tenantId } })
  if (!settings?.notifyNfeError || !settings.fromEmail) return

  const body = `
    <p style="color:#374151;font-size:14px">Falha ao emitir NF-e para o pedido <strong>#${externalId}</strong>.</p>
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px;margin:12px 0">
      <p style="color:#DC2626;font-size:13px;margin:0;font-family:monospace">${error}</p>
    </div>`

  await sendEmailNotification(tenantId, {
    to: settings.fromEmail,
    subject: `❗ Erro na emissão de NF-e — Pedido #${externalId}`,
    html: baseTemplate('Erro na Emissão de NF-e', body),
  })
}

export async function notifyReturnRequestedEmail(tenantId: string, returnId: string, orderExternalId: string, buyer: string) {
  const settings = await prisma.emailSettings.findUnique({ where: { tenantId } })
  if (!settings?.notifyReturn || !settings.fromEmail) return

  const body = `<p style="color:#374151;font-size:14px">O comprador <strong>${buyer}</strong> solicitou devolução do pedido <strong>#${orderExternalId}</strong>. Acesse o SellSync para revisar e aprovar.</p>`

  await sendEmailNotification(tenantId, {
    to: settings.fromEmail,
    subject: `↩️ Devolução solicitada — Pedido #${orderExternalId}`,
    html: baseTemplate('Solicitação de Devolução', body),
  })
}
