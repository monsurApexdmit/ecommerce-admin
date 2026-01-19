"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/auth-context"
import { Building2, Mail, Phone, MapPin, Bell, Lock, Globe } from "lucide-react"
import Swal from "sweetalert2"

export default function SettingsPage() {
  const { userEmail } = useAuth()
  const [storeName, setStoreName] = useState("Dashtar Store")
  const [storeEmail, setStoreEmail] = useState("store@dashtar.com")
  const [storePhone, setStorePhone] = useState("+1 (555) 123-4567")
  const [storeAddress, setStoreAddress] = useState("123 Business St, New York, NY 10001")
  const [storeDescription, setStoreDescription] = useState(
    "Your one-stop shop for all your electronic and accessory needs.",
  )

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [orderNotifications, setOrderNotifications] = useState(true)
  const [marketingEmails, setMarketingEmails] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSaveGeneral = () => {
    // Save general settings
    Swal.fire({
      title: "Success!",
      text: "General settings saved successfully!",
      icon: "success",
      confirmButtonColor: "#10b981",
    })
  }

  const handleSaveNotifications = () => {
    // Save notification settings
    Swal.fire({
      title: "Success!",
      text: "Notification settings saved successfully!",
      icon: "success",
      confirmButtonColor: "#10b981",
    })
  }

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      Swal.fire({
        title: "Error!",
        text: "Passwords do not match!",
        icon: "error",
        confirmButtonColor: "#ef4444",
      })
      return
    }
    if (newPassword.length < 8) {
      Swal.fire({
        title: "Error!",
        text: "Password must be at least 8 characters!",
        icon: "error",
        confirmButtonColor: "#ef4444",
      })
      return
    }
    // Change password
    Swal.fire({
      title: "Success!",
      text: "Password changed successfully!",
      icon: "success",
      confirmButtonColor: "#10b981",
    })
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and store preferences</p>
      </div>

      {/* General Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">General Settings</h2>
            <p className="text-sm text-gray-600">Update your store information</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Store Name</Label>
              <Input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeEmail">Store Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="storeEmail"
                  type="email"
                  value={storeEmail}
                  onChange={(e) => setStoreEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storePhone">Store Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="storePhone"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeAddress">Store Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="storeAddress"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="storeDescription">Store Description</Label>
            <Textarea
              id="storeDescription"
              value={storeDescription}
              onChange={(e) => setStoreDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveGeneral} className="bg-emerald-600 hover:bg-emerald-700">
              Save Changes
            </Button>
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Notification Settings</h2>
            <p className="text-sm text-gray-600">Manage how you receive notifications</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-gray-600">Receive email updates about your account</p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Order Notifications</p>
              <p className="text-sm text-gray-600">Get notified when orders are placed or updated</p>
            </div>
            <Switch checked={orderNotifications} onCheckedChange={setOrderNotifications} />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Marketing Emails</p>
              <p className="text-sm text-gray-600">Receive promotional emails and updates</p>
            </div>
            <Switch checked={marketingEmails} onCheckedChange={setMarketingEmails} />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveNotifications} className="bg-emerald-600 hover:bg-emerald-700">
              Save Preferences
            </Button>
          </div>
        </div>
      </Card>

      {/* Security Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Security Settings</h2>
            <p className="text-sm text-gray-600">Change your password and security preferences</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Email</Label>
            <Input value={userEmail || ""} disabled className="bg-gray-50" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleChangePassword} className="bg-emerald-600 hover:bg-emerald-700">
              Change Password
            </Button>
          </div>
        </div>
      </Card>

      {/* Regional Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Regional Settings</h2>
            <p className="text-sm text-gray-600">Set your language, currency, and timezone</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Input id="language" value="English (US)" disabled className="bg-gray-50" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" value="USD ($)" disabled className="bg-gray-50" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" value="America/New_York" disabled className="bg-gray-50" />
          </div>
        </div>
      </Card>
    </div>
  )
}
