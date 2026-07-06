"use client"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import toast from "react-hot-toast"

export default function SettingsPage() {
  const [form, setForm] = useState({
    email: "",
    telegram: "",
    discord: "",
    slack: "",
  })

  function handleSave() {
    toast.success("Settings saved!")
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Settings
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Configure your monitoring preferences
 </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="notifications@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            id="telegram"
            label="Telegram Bot Token"
            placeholder="Your bot token"
            value={form.telegram}
            onChange={(e) => setForm({ ...form, telegram: e.target.value })}
          />
          <Input
            id="discord"
            label="Discord Webhook URL"
            placeholder="https://discord.com/api/webhooks/..."
            value={form.discord}
            onChange={(e) => setForm({ ...form, discord: e.target.value })}
          />
          <Input
            id="slack"
            label="Slack Webhook URL"
            placeholder="https://hooks.slack.com/services/..."
            value={form.slack}
            onChange={(e) => setForm({ ...form, slack: e.target.value })}
          />
          <Button onClick={handleSave}>Save Settings</Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monitoring Defaults</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Input
            id="interval"
            label="Default Check Interval (minutes)"
            type="number"
            defaultValue={5}
          />
          <Input
            id="timeout"
            label="Request Timeout (seconds)"
            type="number"
            defaultValue={30}
          />
          <Button onClick={handleSave}>Save Defaults</Button>
        </div>
      </Card>
    </div>
  )
}
