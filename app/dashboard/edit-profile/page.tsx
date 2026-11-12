"use client"

import { useEffect, useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { User, Mail, Lock, Camera, Save } from "lucide-react"
import { FormField } from "@/components/common/FormField"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { UserAvatar } from "@/components/common/UserAvatar"
import Swal from "sweetalert2"
import { WithTooltip } from "@/components/common/WithTooltip"

// Role codes from the auth user → display labels (unknown codes are shown capitalised)
const ROLE_KEY: Record<string, ParseKeys<["account"]>> = {
  owner: "account:profile.roles.owner", admin: "account:profile.roles.admin", manager: "account:profile.roles.manager",
  staff: "account:profile.roles.staff", super_admin: "account:profile.roles.superAdmin",
}

export default function EditProfilePage() {
  const { t } = useTranslation(["account", "common"])
  const { user } = useSaasAuth()
  const userEmail = user?.email || ""
  const userName = user?.fullName || ""
  const roleCode = user?.role ? String(user.role) : ""
  const userRole = !roleCode ? t("account:profile.notAvailable") : ROLE_KEY[roleCode] ? t(ROLE_KEY[roleCode]) : roleCode.charAt(0).toUpperCase() + roleCode.slice(1)
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
        title: t("account:profile.successTitle"),
        text: t("account:profile.profileUpdated"),
        icon: "success",
        confirmButtonText: t("account:profile.ok"),
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
        title: t("account:profile.errorTitle"),
        text: t("account:profile.mismatch"),
        icon: "error",
        confirmButtonText: t("account:profile.ok"),
        confirmButtonColor: "#ef4444",
      })
      return
    }

    if (newPassword.length < 8) {
      Swal.fire({
        title: t("account:profile.errorTitle"),
        text: t("account:profile.tooShort"),
        icon: "error",
        confirmButtonText: t("account:profile.ok"),
        confirmButtonColor: "#ef4444",
      })
      return
    }

    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      Swal.fire({
        title: t("account:profile.successTitle"),
        text: t("account:profile.passwordUpdated"),
        icon: "success",
        confirmButtonText: t("account:profile.ok"),
        confirmButtonColor: "#10b981",
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    }, 1000)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title={t("account:profile.title")} description={t("account:profile.description")} />

      <div className="grid grid-cols-1 gap-6">
        {/* Profile Information */}
        <SectionCard
          title={<span className="flex items-center gap-2"><User className="size-4 text-muted-foreground" />{t("account:profile.info")}</span>}
          description={t("account:profile.infoDesc")}
        >

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <UserAvatar className="size-32" src={avatar} alt={t("account:profile.photoAlt")} fallback="AD" />
                  <WithTooltip content={t("account:profile.changePhoto")}><Button
                    type="button"
                    size="icon-sm"
                    onClick={triggerFileInput}
                    aria-label={t("account:profile.changePhoto")}
                    className="absolute bottom-0 right-0 rounded-full"
                  >
                    <Camera className="w-4 h-4" />
                  </Button></WithTooltip>
                  <Input
                    type="file"
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{t("account:profile.allowed")}</p>
              </div>

              <div className="flex-1 space-y-4 w-full">
                <FormField label={t("account:profile.fullName")} htmlFor="name">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      placeholder={t("account:profile.namePlaceholder")}
                    />
                  </div>
                </FormField>

                <FormField label={t("account:profile.email")} htmlFor="email">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      placeholder={t("account:profile.emailPlaceholder")}
                    />
                  </div>
                </FormField>

                <FormField label={t("account:profile.role")} htmlFor="role">
                  <Input
                    id="role"
                    value={userRole}
                    readOnly
                  />
                </FormField>

                <div className="pt-2">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? t("common:actions.saving") : t("common:actions.saveChanges")}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </SectionCard>

        {/* Security Settings */}
        <SectionCard
          title={<span className="flex items-center gap-2"><Lock className="size-4 text-muted-foreground" />{t("account:profile.security")}</span>}
          description={t("account:profile.securityDesc")}
        >

          <form onSubmit={handleUpdatePassword} className="max-w-xl space-y-4">
            <FormField label={t("account:profile.currentPassword")} htmlFor="currentPassword">
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("account:profile.currentPlaceholder")}
              />
            </FormField>

            <FormField label={t("account:profile.newPassword")} htmlFor="newPassword">
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("account:profile.newPlaceholder")}
              />
            </FormField>

            <FormField label={t("account:profile.confirmPassword")} htmlFor="confirmPassword">
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("account:profile.confirmPlaceholder")}
              />
            </FormField>

            <div className="pt-2">
              <Button type="submit" variant="outline" disabled={isLoading}>
                {t("account:profile.updatePassword")}
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  )
}
