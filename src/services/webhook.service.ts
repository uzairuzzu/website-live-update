import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export async function getWebhooks(websiteId: string) {
  return prisma.webhook.findMany({ where: { websiteId }, orderBy: { createdAt: "desc" } })
}

export async function createWebhook(data: {
  websiteId: string; userId: string; name: string; url: string; type: string; events: string
}) {
  return prisma.webhook.create({ data })
}

export async function updateWebhook(id: string, data: Partial<{
  name: string; url: string; type: string; events: string; enabled: boolean; secret: string
}>) {
  return prisma.webhook.update({ where: { id }, data })
}

export async function deleteWebhook(id: string) {
  return prisma.webhook.delete({ where: { id } })
}

function formatPayload(webhook: { type: string; name: string; url: string }, event: string, data: any) {
  const color = event === "down" ? 15548997 : event === "up" ? 5763719 : 15844367
  const emoji = event === "down" ? "\u{1F534}" : event === "up" ? "\u{1F7E2}" : "\u26A0\uFE0F"
  const title = `${emoji} ${data.websiteName} \u2014 ${event.toUpperCase()}`

  const fields = [
    { name: "Website", value: data.websiteUrl, inline: true },
    { name: "Status Code", value: String(data.statusCode || "N/A"), inline: true },
    { name: "Response Time", value: data.responseTime ? `${data.responseTime}ms` : "N/A", inline: true },
  ]
  if (data.errorMessage) fields.push({ name: "Error", value: data.errorMessage, inline: false })

  const embed = { title, color, fields, timestamp: new Date().toISOString() }

  switch (webhook.type) {
    case "discord":
      return { embeds: [embed], username: "21by7 Monitor", avatar_url: undefined }
    case "slack":
      return {
        attachments: [{
          color: event === "down" ? "danger" : event === "up" ? "good" : "warning",
          title, fields, ts: Math.floor(Date.now() / 1000),
        }],
      }
    case "telegram": {
      const msg = `*${title}*\nWebsite: ${data.websiteUrl}\nStatus: ${data.statusCode} (${data.responseTime}ms)`
      return { chat_id: "@placeholder", text: msg, parse_mode: "Markdown" }
    }
    default:
      return { event, website: data.websiteName, url: data.websiteUrl, statusCode: data.statusCode,
               responseTime: data.responseTime, errorMessage: data.errorMessage }
  }
}

async function deliverOnce(webhookUrl: string, payload: any, headers: Record<string, string>): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(webhookUrl, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal })
    clearTimeout(timeout)
    const body = await res.text().catch(() => "")
    return { ok: res.ok, status: res.status, body: body.slice(0, 500) }
  } catch (err: any) {
    return { ok: false, status: 0, body: err.message || "Network error" }
  }
}

export async function sendWebhook(webhook: {
  id: string; url: string; type: string; secret: string | null; name: string
}, event: string, data: {
  websiteName: string; websiteUrl: string; statusCode?: number; responseTime?: number; errorMessage?: string
}) {
  const payload = formatPayload(webhook, event, data)
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (webhook.secret) {
    const sig = crypto.createHmac("sha256", webhook.secret).update(JSON.stringify(payload)).digest("hex")
    headers["X-Webhook-Signature"] = sig
  }

  const delivery = await prisma.webhookDelivery.create({
    data: { webhookId: webhook.id, event, payload: JSON.stringify(payload), status: "pending" },
  })

  const result = await deliverOnce(webhook.url, payload, headers)

  if (result.ok) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "delivered", statusCode: result.status, response: result.body, attempts: 1, deliveredAt: new Date() },
    })
    return true
  }

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: { status: "failed", statusCode: result.status, response: result.body, attempts: 1 },
  })

  scheduleRetry(delivery.id, 1, webhook, payload, headers)
  return false
}

async function scheduleRetry(deliveryId: string, attempt: number, webhook: { id: string; url: string; type: string; secret: string | null; name: string }, payload: any, headers: Record<string, string>) {
  const maxAttempts = 5
  if (attempt >= maxAttempts) {
    await prisma.webhookDelivery.update({ where: { id: deliveryId }, data: { status: "dead" } })
    return
  }

  const delayMs = Math.min(60000, 2000 * Math.pow(2, attempt - 1))
  const nextRetry = new Date(Date.now() + delayMs)

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: { nextRetryAt: nextRetry, attempts: attempt },
  })

  setTimeout(async () => {
    const result = await deliverOnce(webhook.url, payload, headers)
    if (result.ok) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: "delivered", statusCode: result.status, response: result.body, attempts: attempt + 1, deliveredAt: new Date() },
      })
    } else {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: result.status === 0 ? "retrying" : "failed", statusCode: result.status, response: result.body, attempts: attempt + 1 },
      })
      scheduleRetry(deliveryId, attempt + 1, webhook, payload, headers)
    }
  }, delayMs)
}

export async function getWebhookDeliveries(webhookId: string, limit = 20) {
  return prisma.webhookDelivery.findMany({
    where: { webhookId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, event: true, status: true, statusCode: true, attempts: true, createdAt: true, deliveredAt: true, response: true },
  })
}

export async function retryDelivery(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { webhook: true } })
  if (!delivery || !delivery.webhook) return false

  const webhook = delivery.webhook
  const payload = JSON.parse(delivery.payload)
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (webhook.secret) {
    const sig = crypto.createHmac("sha256", webhook.secret).update(JSON.stringify(payload)).digest("hex")
    headers["X-Webhook-Signature"] = sig
  }

  await prisma.webhookDelivery.update({ where: { id: deliveryId }, data: { status: "retrying", attempts: 0 } })
  scheduleRetry(deliveryId, 0, webhook, payload, headers)
  return true
}
