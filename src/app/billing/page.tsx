"use client"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

const plans = [
  {
    name: "Free",
    price: "$0",
    features: ["Up to 3 websites", "5 min check interval", "Email notifications", "48h data retention"],
  },
  {
    name: "Pro",
    price: "$12",
    popular: true,
    features: ["Up to 25 websites", "1 min check interval", "All notification channels", "30 day data retention", "SSL monitoring", "API access"],
  },
  {
    name: "Enterprise",
    price: "$49",
    features: ["Unlimited websites", "30s check interval", "Priority support", "1 year data retention", "Custom integrations", "Team access"],
  },
]

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Billing</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Choose the right plan for you
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.name} className={plan.popular ? "ring-2 ring-[var(--primary)]" : ""}>
            <CardHeader>
              <div>
                <CardTitle className="text-lg text-[var(--foreground)] font-semibold">
                  {plan.name}
                </CardTitle>
                {plan.popular && (
                  <span className="inline-block mt-1 text-xs font-medium text-[var(--primary)]">
                    Most Popular
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold text-[var(--foreground)]">
                {plan.price}
                <span className="text-sm font-normal text-[var(--muted-foreground)]">/mo</span>
              </div>
            </CardHeader>
            <div className="space-y-3">
              {plan.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                  <Check className="w-4 h-4 text-emerald-500" />
                  {f}
                </div>
              ))}
            </div>
            <Button className="w-full mt-6" variant={plan.popular ? "primary" : "secondary"}>
              {plan.name === "Free" ? "Current Plan" : "Upgrade"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
