"use client"

import { useSession } from "next-auth/react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import toast from "react-hot-toast"

export default function ProfilePage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Profile</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Manage your account information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Input
            id="name"
            label="Name"
            defaultValue={session?.user?.name || ""}
          />
          <Input
            id="email"
            label="Email"
            type="email"
            defaultValue={session?.user?.email || ""}
            disabled
          />
          <Button
            onClick={() => toast.success("Profile updated!")}
          >
            Update Profile
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Input
            id="current"
            label="Current Password"
            type="password"
          />
          <Input
            id="new"
            label="New Password"
            type="password"
          />
          <Input
            id="confirm"
            label="Confirm Password"
            type="password"
          />
          <Button onClick={() => toast.success("Password changed!")}>
            Change Password
          </Button>
        </div>
      </Card>
    </div>
  )
}
