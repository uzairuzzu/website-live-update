import Link from "next/link"
import { Activity, Globe, BarChart3, Bell, Shield, Zap } from "lucide-react"

const features = [
  { icon: Globe, title: "Website Monitoring", desc: "Monitor uptime & performance 24/7" },
  { icon: BarChart3, title: "Analytics", desc: "Detailed response time & uptime charts" },
  { icon: Bell, title: "Notifications", desc: "Get alerts via email, Discord, Slack" },
  { icon: Shield, title: "SSL Monitoring", desc: "Track SSL certificate expiry" },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">21by7</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm bg-[var(--primary)] text-white px-4 py-2 rounded-lg hover:bg-[var(--primary)]/90"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-sm mb-6">
          <Zap className="w-3.5 h-3.5" />
          Real-time monitoring platform
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-[var(--foreground)] mb-4">
          Monitor your websites{" "}
          <span className="text-[var(--primary)]">24/7</span>
        </h1>
        <p className="text-lg text-[var(--muted-foreground)] max-w-xl mx-auto mb-8">
          Track uptime, response times, SSL certificates, and get instant
          notifications when something goes wrong.
        </p>
        <Link
          href="/register"
          className="inline-flex bg-[var(--primary)] text-white px-6 py-3 rounded-lg font-medium hover:bg-[var(--primary)]/90"
        >
          Start Monitoring Free
        </Link>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <h3 className="font-semibold text-[var(--foreground)] mb-1">
                {f.title}
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
