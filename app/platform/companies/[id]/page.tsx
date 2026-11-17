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
import { Trans, useTranslation } from "react-i18next"
import { localeTag } from "@/lib/i18n"

const STATUS_LABEL: Record<string, "auth:platform.status.active" | "auth:platform.status.trial" | "auth:platform.status.inactive" | "auth:platform.status.suspended"> = {
  active: "auth:platform.status.active",
  trial: "auth:platform.status.trial",
  inactive: "auth:platform.status.inactive",
  suspended: "auth:platform.status.suspended",
}

export default function CompanyDetailPage() {
  const { t, i18n } = useTranslation(["auth", "common"])
  const dateTag = localeTag(i18n.language)
  /** Known company/user statuses are translated; anything else from the API is shown as is */
  const statusLabel = (status: string) => (STATUS_LABEL[status] ? t(STATUS_LABEL[status]) : status)
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
    }).catch(() => setError(t("auth:platform.company.loadFailed")))
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
      flash(t("auth:platform.company.assigned"))
    } catch {
      flash(t("auth:platform.company.assignFailed"))
    } finally {
      setAssigning(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm(t("auth:platform.company.confirmCancel"))) return
    setCancelling(true)
    try {
      await platformApi.cancelSubscription(companyId)
      setCompany(prev => prev ? { ...prev, subscription: prev.subscription ? { ...prev.subscription, status: "cancelled" } : null } : prev)
      flash(t("auth:platform.company.cancelled"))
    } catch {
      flash(t("auth:platform.company.cancelFailed"))
    } finally {
      setCancelling(false)
    }
  }

  const handleSaveSubdomain = async () => {
    setSavingSubdomain(true)
    try {
      const updated = await platformApi.updateCompany(companyId, { subdomain: subdomain.trim() || undefined })
      setCompany(prev => prev ? { ...prev, subdomain: updated.subdomain } : prev)
      flash(t("auth:platform.company.subdomainSaved"))
    } catch {
      flash(t("auth:platform.company.subdomainFailed"))
    } finally {
      setSavingSubdomain(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!company) return
    const next = company.status === "inactive" || company.status === "suspended" ? "active" : "inactive"
    if (!confirm(next === "inactive" ? t("auth:platform.company.confirmDeactivate") : t("auth:platform.company.confirmActivate"))) return
    setToggling(true)
    try {
      await platformApi.updateCompanyStatus(companyId, next)
      setCompany(prev => prev ? { ...prev, status: next } : prev)
      flash(next === "active" ? t("auth:platform.company.activated") : t("auth:platform.company.deactivated"))
    } catch {
      flash(t("auth:platform.company.statusFailed"))
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
      <AlertDescription>{error || t("auth:platform.company.notFound")}</AlertDescription>
    </Alert>
  )

  const activeSub = company.subscription?.status === "active" ? company.subscription : null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <Link href="/platform/companies">
            <ArrowLeft /> {t("auth:platform.nav.companies")}
          </Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold">{company.name}</h1>
        <StatusBadge status={company.status} label={statusLabel(company.status)} />
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
          <SectionCard title={t("auth:platform.company.info")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Mail, label: t("common:fields.email"), value: company.email },
                { icon: Phone, label: t("common:fields.phone"), value: company.phone },
                { icon: Globe, label: t("auth:platform.company.country"), value: company.country },
                { icon: Calendar, label: t("auth:platform.companies.joined"), value: new Date(company.createdAt).toLocaleDateString(dateTag) },
                { icon: Users, label: t("auth:platform.company.teamSize"), value: t("auth:platform.company.usersCount", { count: company.usersCount }) },
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
            title={t("auth:platform.company.subdomainTitle")}
            description={<Trans t={t} i18nKey="auth:platform.company.subdomainDesc" components={{ code: <code className="bg-muted px-1 rounded" /> }} />}
          >
            <div className="flex gap-2 items-center">
              <InputGroup className="flex-1">
                <InputGroupInput
                  type="text"
                  value={subdomain}
                  onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder={t("auth:platform.company.subdomainPlaceholder")}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>.localhost:8080</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <Button
                onClick={handleSaveSubdomain}
                disabled={savingSubdomain}
              >
                {savingSubdomain ? t("common:actions.saving") : t("common:actions.save")}
              </Button>
            </div>
            {company.subdomain && (
              <p className="mt-2 text-xs text-muted-foreground">
                <Trans
                  t={t}
                  i18nKey="auth:platform.company.currentSubdomain"
                  values={{ host: `${company.subdomain}.localhost:8080`, hosts: `127.0.0.1 ${company.subdomain}.localhost` }}
                  components={{
                    host: <code className="bg-muted px-1 rounded text-foreground" />,
                    hosts: <code className="bg-muted px-1 rounded" />,
                  }}
                />
              </p>
            )}
          </SectionCard>

          {/* Users table */}
          <SectionCard
            title={<span className="flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" />{t("auth:platform.company.team")}</span>}
            actions={<Badge variant="secondary">{company.users?.length ?? 0}</Badge>}
            contentClassName="px-0"
          >
            {!company.users?.length ? (
              <EmptyState title={t("auth:platform.company.noUsers")} className="p-4 md:p-6" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common:fields.name")}</TableHead>
                    <TableHead>{t("auth:platform.company.role")}</TableHead>
                    <TableHead>{t("common:fields.status")}</TableHead>
                    <TableHead>{t("auth:platform.company.lastLogin")}</TableHead>
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
                        <StatusBadge status={u.status} label={statusLabel(u.status)} />
                      </TableCell>
                      <TableCell>
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString(dateTag) : t("auth:platform.company.never")}
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
          <SectionCard title={<span className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-muted-foreground" />{t("auth:platform.company.subscription")}</span>}>
            {activeSub ? (
              <div className="space-y-2">
                <InfoList>
                  <InfoRow label={t("auth:platform.companies.plan")} value={activeSub.planName} />
                  <InfoRow label={t("common:money.price")} value={t("auth:platform.company.priceMonthly", { price: activeSub.planPrice })} />
                  <InfoRow
                    label={t("auth:platform.company.expires")}
                    value={activeSub.currentPeriodEnd ? new Date(activeSub.currentPeriodEnd).toLocaleDateString(dateTag) : "—"}
                  />
                  <InfoRow label={t("common:fields.status")} value={<StatusBadge status="active" label={t("auth:platform.status.active")} />} />
                </InfoList>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="mt-3 w-full"
                >
                  {cancelling ? t("auth:platform.company.cancelling") : t("auth:platform.company.cancelSub")}
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">{t("auth:platform.company.noActiveSub")}</p>
              </div>
            )}
          </SectionCard>

          {/* Assign plan */}
          <SectionCard title={activeSub ? t("auth:platform.company.changePlan") : t("auth:platform.company.assignPlan")}>
            <div className="space-y-3">
              <Select
                value={selectedPlanId === "" ? "" : String(selectedPlanId)}
                onValueChange={v => setSelectedPlanId(Number(v) || "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("auth:platform.company.selectPlan")} />
                </SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.isActive).map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{t("auth:platform.company.planOption", { name: p.name, price: p.price })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormField label={t("auth:platform.company.months")} htmlFor="assign-months" orientation="horizontal">
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
                {assigning ? t("auth:platform.company.assigning") : activeSub ? t("auth:platform.company.changePlan") : t("auth:platform.company.assign")}
              </Button>
            </div>
          </SectionCard>

          {/* Danger zone */}
          <SectionCard title={<span className="text-destructive">{t("auth:platform.company.dangerZone")}</span>} className="border-destructive/30">
            <Button
              variant={company.status === "inactive" || company.status === "suspended" ? "default" : "destructive"}
              onClick={handleToggleStatus}
              disabled={toggling}
              className="w-full"
            >
              {toggling ? t("auth:platform.company.updating") : (company.status === "inactive" || company.status === "suspended" ? t("auth:platform.company.activateCompany") : t("auth:platform.company.deactivateCompany"))}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              {company.status === "inactive" || company.status === "suspended"
                ? t("auth:platform.company.reenableHelp")
                : t("auth:platform.company.blockHelp")}
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
