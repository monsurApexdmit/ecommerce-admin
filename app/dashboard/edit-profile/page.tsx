"use client"

import { useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { User, Mail, Lock, Camera, Save } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Swal from "sweetalert2"

export default function EditProfilePage() {
  const { userEmail } = useAuth()
  const [name, setName] = useState("Admin User")
  const [email, setEmail] = useState(userEmail || "")
  const [avatar, setAvatar] = useState("/admin-avatar.jpg")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      Swal.fire({
        title: "Success!",
        text: "Profile updated successfully!",
        icon: "success",
        confirmButtonColor: "#10b981",
      })
    }, 1000)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatar(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault()
    
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

    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      Swal.fire({
        title: "Success!",
        text: "Password updated successfully!",
        icon: "success",
        confirmButtonColor: "#10b981",
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    }, 1000)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
        <p className="text-gray-600 mt-1">Update your personal information and security settings</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Profile Information */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Profile Information</h2>
              <p className="text-sm text-gray-600">Update your account details and public profile</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="w-32 h-32 border-4 border-white shadow-lg">
                    <AvatarImage src={avatar} alt="Profile" />
                    <AvatarFallback className="text-4xl bg-emerald-100 text-emerald-700">AD</AvatarFallback>
                  </Avatar>
                  <button 
                    type="button" 
                    onClick={triggerFileInput}
                    className="absolute bottom-0 right-0 p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
                <p className="text-sm text-gray-500">Allowed *.jpeg, *.jpg, *.png, *.gif</p>
              </div>

              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </Card>

        {/* Security Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Lock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Security</h2>
              <p className="text-sm text-gray-600">Change your password</p>
            </div>
          </div>

          <form onSubmit={handleUpdatePassword} className="max-w-xl space-y-4">
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
                placeholder="Enter new password (min. 8 characters)"
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

            <div className="pt-2">
              <Button type="submit" variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50" disabled={isLoading}>
                Update Password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
