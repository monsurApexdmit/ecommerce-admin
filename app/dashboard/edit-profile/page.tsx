"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { User, Mail, Lock, Camera, Save } from "lucide-react"
import { FormField } from "@/components/common/FormField"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { UserAvatar } from "@/components/common/UserAvatar"
import Swal from "sweetalert2"

export default function EditProfilePage() {
  const { user } = useSaasAuth()
  const userEmail = user?.email || ""
  const userName = user?.fullName || ""
  const userRole = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "N/A"
  const [name, setName] = useState(userName || "")
  const [email, setEmail] = useState(userEmail || "")
  const [avatar, setAvatar] = useState("/admin-avatar.jpg")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(userName || "")
    setEmail(userEmail || "")
  }, [userName, userEmail])

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
      <PageHeader title="Edit Profile" description="Update your personal information and security settings" />

      <div className="grid grid-cols-1 gap-6">
        {/* Profile Information */}
        <SectionCard
          title={<span className="flex items-center gap-2"><User className="size-4 text-muted-foreground" />Profile Information</span>}
          description="Update your account details and public profile"
        >

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <UserAvatar className="size-32" src={avatar} alt="Profile" fallback="AD" />
                  <Button
                    type="button"
                    size="icon-sm"
                    onClick={triggerFileInput}
                    aria-label="Change profile photo"
                    className="absolute bottom-0 right-0 rounded-full"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                  <Input
                    type="file"
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
                <p className="text-sm text-muted-foreground">Allowed *.jpeg, *.jpg, *.png, *.gif</p>
              </div>

              <div className="flex-1 space-y-4 w-full">
                <FormField label="Full Name" htmlFor="name">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      placeholder="Enter your full name"
                    />
                  </div>
                </FormField>

                <FormField label="Email Address" htmlFor="email">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      placeholder="Enter your email"
                    />
                  </div>
                </FormField>

                <FormField label="Role" htmlFor="role">
                  <Input
                    id="role"
                    value={userRole}
                    readOnly
                  />
                </FormField>

                <div className="pt-2">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </SectionCard>

        {/* Security Settings */}
        <SectionCard
          title={<span className="flex items-center gap-2"><Lock className="size-4 text-muted-foreground" />Security</span>}
          description="Change your password"
        >

          <form onSubmit={handleUpdatePassword} className="max-w-xl space-y-4">
            <FormField label="Current Password" htmlFor="currentPassword">
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </FormField>

            <FormField label="New Password" htmlFor="newPassword">
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 8 characters)"
              />
            </FormField>

            <FormField label="Confirm New Password" htmlFor="confirmPassword">
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </FormField>

            <div className="pt-2">
              <Button type="submit" variant="outline" disabled={isLoading}>
                Update Password
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  )
}
