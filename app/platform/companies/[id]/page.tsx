"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { platformApi, PlatformCompany, PlatformPlan } from "@/lib/platformApi"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SectionCard } from "@/components/common/SectionCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowLeft, AlertCircle, Users, CreditCard, CheckCircle2,
  Clock, XCircle, Calendar, Globe, Phone, Mail,
} from "lucide-react"

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const companyId = parseInt(id)

  const [company, setCompany] = useState<PlatformCompany | null>(null)
  const [plans, setPlans] = useState<PlatformPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [selectedPlanId, setSelectedPlanId] = useState<number | "">("")
  const [selectedMonths, setSelectedMonths] = useState(1)
  const [assigning, setAssigning] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [actionMsg, setActionMsg] = useState("")
  const [subdomain, setSubdomain] = useState("")
  const [savingSubdomain, setSavingSubdomain] = useState(false)

  useEffect(() => {
    Promise.all([
      platformApi.getCompany(companyId),
      platformApi.listPlans(),
    ]).then(([c, p]) => {
      setCompany(c)
      setSubdomain(c.subdomain ?? "")
      setPlans(p)
    }).catch(() => setError("Failed to load company"))
      .finally(() => setLoading(false))
  }, [companyId])

  const flash = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(""), 3000)
  }

  const handleAssign = async () => {
    if (!selectedPlanId) return
    setAssigning(true)
    try {
      const sub = await platformApi.assignSubscription(companyId, Number(selectedPlanId), selectedMonths)
      setCompany(prev => prev ? { ...prev, status: "active", subscription: sub } : prev)
      setSelectedPlanId("")
      flash("Subscription assigned successfully.")
    } catch {
      flash("Failed to assign subscription.")
    } finally {
      setAssigning(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm("Cancel this company's subscription?")) return
    setCancelling(true)
    try {
      await platformApi.cancelSubscription(companyId)
      setCompany(prev => prev ? { ...prev, subscription: prev.subscription ? { ...prev.subscription, status: "cancelled" } : null } : prev)
      flash("Subscription cancelled.")
    } catch {
      flash("Failed to cancel subscription.")
    } finally {
      setCancelling(false)
    }
  }

  const handleSaveSubdomain = async () => {
    setSavingSubdomain(true)
    try {
      const updated = await platformApi.updateCompany(companyId, { subdomain: subdomain.trim() || undefined })
      setCompany(prev => prev ? { ...prev, subdomain: updated.subdomain } : prev)
      flash("Store subdomain saved.")
    } catch {
      flash("Failed to save subdomain.")
    } finally {
      setSavingSubdomain(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!company) return
    const next = company.status === "inactive" || company.status === "suspended" ? "active" : "inactive"
    if (!confirm(`${next === "inactive" ? "Deactivate" : "Activate"} this company?`)) return
    setToggling(true)
    try {
      await platformApi.updateCompanyStatus(companyId, next)
      setCompany(prev => prev ? { ...prev, status: next } : prev)
      flash(`Company ${next === "active" ? "activated" : "deactivated"}.`)
    } catch {
      flash("Failed to update status.")
    } finally {
      setToggling(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner className="size-6" /></div>
  )
  if (error || !company) return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{error || "Company not found"}</AlertDescription>
    </Alert>
  )

  const activeSub = company.subscription?.status === "active" ? company.subscription : null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <Link href="/platform/companies">
            <ArrowLeft /> Companies
          </Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold">{company.name}</h1>
        <StatusBadge status={company.status} />
      </div>

      {actionMsg && (
        <Alert>
          <AlertDescription>{actionMsg}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company info */}
          <SectionCard title="Company Info">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Mail, label: "Email", value: company.email },
                { icon: Phone, label: "Phone", value: company.phone },
                { icon: Globe, label: "Country", value: company.country },
                { icon: Calendar, label: "Joined", value: new Date(company.createdAt).toLocaleDateString() },
                { icon: Users, label: "Team Size", value: `${company.usersCount} users` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm">{value || <span className="text-muted-foreground">—</span>}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Store subdomain */}
          <SectionCard
            title="Aura Store Subdomain"
            description={<>Used to route <code className="bg-muted px-1 rounded">subdomain.yourstore.com</code> to this company's store.</>}
          >
            <div className="flex gap-2 items-center">
              <InputGroup className="flex-1">
                <InputGroupInput
                  type="text"
                  value={subdomain}
                  onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="e.g. acme"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>.localhost:8080</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <Button
                onClick={handleSaveSubdomain}
                disabled={savingSubdomain}
              >
                {savingSubdomain ? "Saving…" : "Save"}
              </Button>
            </div>
            {company.subdomain && (
              <p className="mt-2 text-xs text-muted-foreground">
                Current: <code className="bg-muted px-1 rounded text-foreground">{company.subdomain}.localhost:8080</code>
                {" — add "}<code className="bg-muted px-1 rounded">127.0.0.1 {company.subdomain}.localhost</code>{" to /etc/hosts"}
              </p>
            )}
          </SectionCard>

          {/* Users table */}
          <SectionCard
            title={<span className="flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" />Team Members</span>}
            actions={<Badge variant="secondary">{company.users?.length ?? 0}</Badge>}
            contentClassName="px-0"
          >
            {!company.users?.length ? (
              <EmptyState title="No users found" className="p-4 md:p-6" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {company.users!.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="font-medium">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={u.status} />
                      </TableCell>
                      <TableCell>
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Subscription card */}
          <SectionCard title={<span className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-muted-foreground" />Subscription</span>}>
            {activeSub ? (
              <div className="space-y-2">
                <InfoList>
                  <InfoRow label="Plan" value={activeSub.planName} />
                  <InfoRow label="Price" value={`$${activeSub.planPrice}/mo`} />
                  <InfoRow
                    label="Expires"
                    value={activeSub.currentPeriodEnd ? new Date(activeSub.currentPeriodEnd).toLocaleDateString() : "—"}
                  />
                  <InfoRow label="Status" value={<StatusBadge status="active" label="Active" />} />
                </InfoList>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="mt-3 w-full"
                >
                  {cancelling ? "Cancelling…" : "Cancel Subscription"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">No active subscription</p>
              </div>
            )}
          </SectionCard>

          {/* Assign plan */}
          <SectionCard title={activeSub ? "Change Plan" : "Assign Plan"}>
            <div className="space-y-3">
              <Select
                value={selectedPlanId === "" ? "" : String(selectedPlanId)}
                onValueChange={v => setSelectedPlanId(Number(v) || "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a plan…" />
                </SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.isActive).map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} — ${p.price}/mo</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormField label="Months" htmlFor="assign-months" orientation="horizontal">
                <Input
                  id="assign-months"
                  type="number"
                  min={1}
                  max={24}
                  value={selectedMonths}
                  onChange={e => setSelectedMonths(parseInt(e.target.value) || 1)}
                  className="flex-1"
                />
              </FormField>
              <Button
                onClick={handleAssign}
                disabled={!selectedPlanId || assigning}
                className="w-full"
              >
                {assigning ? "Assigning…" : activeSub ? "Change Plan" : "Assign & Activate"}
              </Button>
            </div>
          </SectionCard>

          {/* Danger zone */}
          <SectionCard title={<span className="text-destructive">Danger Zone</span>} className="border-destructive/30">
            <Button
              variant={company.status === "inactive" || company.status === "suspended" ? "default" : "destructive"}
              onClick={handleToggleStatus}
              disabled={toggling}
              className="w-full"
            >
              {toggling ? "Updating…" : (company.status === "inactive" || company.status === "suspended" ? "Activate Company" : "Deactivate Company")}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              {company.status === "inactive" || company.status === "suspended"
                ? "Re-enables all users of this company."
                : "Blocks all users from logging in."}
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
