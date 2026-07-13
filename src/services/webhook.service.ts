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
  const emoji = event === "down" ? "🔴" : event === "up" ? "🟢" : "⚠️"
  const title = `${emoji} ${data.websiteName} — ${event.toUpperCase()}`

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
      return { event, website: data.websiteName, url: data.websiteUrl, statusCode: data.statusCode, responseTime: data.responseTime, errorMessage: data.errorMessage }
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

  try {
    const res = await fetch(webhook.url, { method: "POST", headers, body: JSON.stringify(payload) })
    return res.ok
  } catch { return false }
}
