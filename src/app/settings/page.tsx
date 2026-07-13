"use client"
import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import toast from "react-hot-toast"

type Webhook = { id: string; name: string; url: string; type: string; events: string; enabled: boolean }
type Tag = { id: string; name: string; color: string }

export default function SettingsPage() {
  const [tab, setTab] = useState("webhooks")
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [showWebhookModal, setShowWebhookModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [whForm, setWhForm] = useState({ websiteId: "", name: "", url: "", type: "discord", events: "down,up" })
  const [tagForm, setTagForm] = useState({ name: "", color: "#6366f1" })
  const [websites, setWebsites] = useState<{ id: string; name: string; url: string }[]>([])
  const [notifForm, setNotifForm] = useState({ email: "", telegram: "", discord: "", slack: "" })

  useEffect(() => {
    fetch("/api/websites").then(r => r.json()).then(setWebsites)
    fetch("/api/tags").then(r => r.json()).then(setTags)
  }, [])

  function loadWebhooks(websiteId: string) {
    if (!websiteId) { setWebhooks([]); return }
    fetch(`/api/webhooks?websiteId=${websiteId}`).then(r => r.json()).then(setWebhooks)
  }

  async function addWebhook() {
    const res = await fetch("/api/webhooks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(whForm),
    })
    if (res.ok) { toast.success("Webhook added"); setShowWebhookModal(false); setWhForm({ websiteId: "", name: "", url: "", type: "discord", events: "down,up" }); loadWebhooks(whForm.websiteId) }
    else toast.error("Failed to add webhook")
  }

  async function deleteWebhook(id: string) {
    const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Webhook deleted"); loadWebhooks(whForm.websiteId) }
  }

  async function toggleWebhook(w: Webhook) {
    const res = await fetch(`/api/webhooks/${w.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !w.enabled }),
    })
    if (res.ok) loadWebhooks(whForm.websiteId)
  }

  async function addTag() {
    const res = await fetch("/api/tags", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tagForm),
    })
    if (res.ok) { toast.success("Tag created"); setShowTagModal(false); setTagForm({ name: "", color: "#6366f1" }); fetch("/api/tags").then(r => r.json()).then(setTags) }
    else toast.error("Failed to create tag")
  }

  async function deleteTag(id: string) {
    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Tag deleted"); fetch("/api/tags").then(r => r.json()).then(setTags) }
  }

  function handleSaveNotif() { toast.success("Notification settings saved!") }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Settings</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Configure your monitoring preferences</p>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {[
          { id: "webhooks", label: "Webhooks" },
          { id: "tags", label: "Tags" },
          { id: "notifications", label: "Notifications" },
        ].map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              tab === t.id ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "webhooks" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Webhook Integrations</CardTitle>
              <Button onClick={() => setShowWebhookModal(true)}>Add Webhook</Button>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Select Website</label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={whForm.websiteId}
                onChange={e => { setWhForm({ ...whForm, websiteId: e.target.value }); loadWebhooks(e.target.value) }}
              >
                <option value="">-- Choose a website --</option>
                {websites.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {webhooks.length === 0 && whForm.websiteId && (
              <p className="text-sm text-[var(--muted-foreground)]">No webhooks for this website yet.</p>
            )}
            {webhooks.map(w => (
              <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary)] text-[var(--secondary-foreground)]">{w.type}</span>
                  <div>
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)] truncate max-w-[300px]">{w.url}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">Events: {w.events}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleWebhook(w)}
                    className={`px-2 py-1 text-xs rounded ${w.enabled ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
                  >
                    {w.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button onClick={() => deleteWebhook(w.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "tags" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tags</CardTitle>
              <Button onClick={() => setShowTagModal(true)}>Create Tag</Button>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {tags.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No tags yet.</p>}
            {tags.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-sm font-medium">{t.name}</span>
                </div>
                <button onClick={() => deleteTag(t.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "notifications" && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Channels</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Input id="email" label="Email" type="email" placeholder="notifications@example.com" value={notifForm.email} onChange={e => setNotifForm({ ...notifForm, email: e.target.value })} />
            <Input id="telegram" label="Telegram Chat ID" placeholder="Your chat ID" value={notifForm.telegram} onChange={e => setNotifForm({ ...notifForm, telegram: e.target.value })} />
            <Input id="discord" label="Discord Webhook URL" placeholder="https://discord.com/api/webhooks/..." value={notifForm.discord} onChange={e => setNotifForm({ ...notifForm, discord: e.target.value })} />
            <Input id="slack" label="Slack Webhook URL" placeholder="https://hooks.slack.com/services/..." value={notifForm.slack} onChange={e => setNotifForm({ ...notifForm, slack: e.target.value })} />
            <Button onClick={handleSaveNotif}>Save Settings</Button>
          </div>
        </Card>
      )}

      <Dialog open={showWebhookModal} onClose={() => setShowWebhookModal(false)} title="Add Webhook">
        <div className="space-y-4">
          <select className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" value={whForm.websiteId} onChange={e => setWhForm({ ...whForm, websiteId: e.target.value })}>
            <option value="">Select Website</option>
            {websites.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <Input label="Name" placeholder="My Discord" value={whForm.name} onChange={e => setWhForm({ ...whForm, name: e.target.value })} />
          <Input label="Webhook URL" placeholder="https://discord.com/api/webhooks/..." value={whForm.url} onChange={e => setWhForm({ ...whForm, url: e.target.value })} />
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" value={whForm.type} onChange={e => setWhForm({ ...whForm, type: e.target.value })}>
              <option value="discord">Discord</option>
              <option value="slack">Slack</option>
              <option value="telegram">Telegram</option>
              <option value="generic">Generic</option>
            </select>
          </div>
          <Input label="Events (comma-separated)" placeholder="down,up" value={whForm.events} onChange={e => setWhForm({ ...whForm, events: e.target.value })} />
          <Button onClick={addWebhook} className="w-full">Add Webhook</Button>
        </div>
      </Dialog>

      <Dialog open={showTagModal} onClose={() => setShowTagModal(false)} title="Create Tag">
        <div className="space-y-4">
          <Input label="Name" placeholder="production" value={tagForm.name} onChange={e => setTagForm({ ...tagForm, name: e.target.value })} />
          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <input type="color" value={tagForm.color} onChange={e => setTagForm({ ...tagForm, color: e.target.value })} className="w-full h-10 rounded-lg border border-[var(--border)] cursor-pointer" />
          </div>
          <Button onClick={addTag} className="w-full">Create Tag</Button>
        </div>
      </Dialog>
    </div>
  )
}
