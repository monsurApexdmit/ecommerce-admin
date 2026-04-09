"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  saasCompanyApi,
  type CompanyUser,
} from "@/lib/saasCompanyApi"
import { staffRoleApi, type StaffRoleResponse } from "@/lib/staffApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import {
  AlertCircle,
  Loader,
  Plus,
  Trash2,
  Mail,
  Shield,
  Calendar,
  Send,
} from "lucide-react"
import { UpgradeRequiredModal } from "@/components/UpgradeRequiredModal"

export default function TeamUsersPage() {
  const { company, user } = useSaasAuth()

  const [users, setUsers] = useState<CompanyUser[]>([])
  const [staffRoles, setStaffRoles] = useState<StaffRoleResponse[]>([])
  const [maxUsers, setMaxUsers] = useState(0)
  const [canAddMore, setCanAddMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [inviting, setInviting] = useState(false)

  const [inviteForm, setInviteForm] = useState({
    email: "",
    fullName: "",
    roleId: 0,
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError("")

        // Load team users
        const usersResponse = await saasCompanyApi.getTeamUsers()
        setUsers(usersResponse.data.users)
        setMaxUsers(usersResponse.data.maxUsers)
        setCanAddMore(usersResponse.data.canAddMore)

        // Load staff roles
        const rolesResponse = await staffRoleApi.getAll({ limit: 100 })
        setStaffRoles(rolesResponse.data || [])
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load team members")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.fullName || !inviteForm.roleId) {
      setError("Please fill in all required fields")
      return
    }

    setInviting(true)
    setError("")
    setSuccessMessage("")

    try {
      await saasCompanyApi.inviteUser({
        email: inviteForm.email,
        fullName: inviteForm.fullName,
        roleId: inviteForm.roleId,
      })

      setSuccessMessage(`Invitation sent to ${inviteForm.email}`)
      setInviteForm({ email: "", fullName: "", roleId: 0 })
      setIsInviteModalOpen(false)

      // Reload users
      const response = await saasCompanyApi.getTeamUsers()
      setUsers(response.data.users)
      setCanAddMore(response.data.canAddMore)

      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send invitation")
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveUser = async (userId: number) => {
    if (!confirm("Are you sure you want to remove this user? This action cannot be undone.")) {
      return
    }

    try {
      await saasCompanyApi.removeUser(userId)
      setSuccessMessage("User removed successfully")
      setUsers(users.filter((u) => u.id !== userId))
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to remove user")
    }
  }

  const handleChangeRole = async (userId: number, newRole: string) => {
    try {
      // If newRole is a staff role name from staffRoles, send it as is
      // Otherwise map to standard role
      const roleToSend = newRole as "admin" | "manager" | "staff";
      await saasCompanyApi.updateUserRole(userId, { role: roleToSend })
      setSuccessMessage("User role updated successfully")
      setUsers(
        users.map((u) =>
          u.id === userId
            ? {
                ...u,
                role: newRole,
                staffRole: staffRoles.find(r => r.name === newRole) || null
              }
            : u
        )
      )
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update user role")
    }
  }

  const handleResendInvitation = async (userId: number) => {
    try {
      await saasCompanyApi.resendInvitation(userId)
      setSuccessMessage("Invitation resent successfully")
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to resend invitation")
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800"
      case "admin":
        return "bg-blue-100 text-blue-800"
      case "manager":
        return "bg-emerald-100 text-emerald-800"
      case "staff":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-800"
      case "invited":
        return "bg-yellow-100 text-yellow-800"
      case "inactive":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading team members...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Members</h1>
          <p className="text-gray-600">
            Manage your team ({users.length}/{maxUsers})
          </p>
        </div>
        <Button
          onClick={() => {
            if (canAddMore) {
              setIsInviteModalOpen(true)
            } else {
              setIsUpgradeModalOpen(true)
            }
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={!canAddMore && maxUsers > 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="bg-red-50 border-red-200 p-6">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* Success Message */}
      {successMessage && (
        <Card className="bg-emerald-50 border-emerald-200 p-6">
          <div className="flex items-center gap-3 text-emerald-800">
            <div className="w-5 h-5 flex-shrink-0">✓</div>
            <p>{successMessage}</p>
          </div>
        </Card>
      )}

      {/* User Limit Warning */}
      {!canAddMore && users.length >= maxUsers && (
        <Card className="bg-yellow-50 border-yellow-200 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-800 flex-shrink-0 mt-0.5" />
            <div className="text-yellow-800">
              <p className="font-semibold mb-1">Team Member Limit Reached</p>
              <p className="text-sm">
                You've reached the maximum number of team members ({maxUsers}) for your plan. Upgrade to add more members.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Invite Team Member</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={inviteForm.fullName}
                  onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role <span className="text-red-500">*</span></label>
                <select
                  value={inviteForm.roleId}
                  onChange={(e) =>
                    setInviteForm({
                      ...inviteForm,
                      roleId: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="0">Select a role...</option>
                  {staffRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {inviting ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsInviteModalOpen(false)}
                  disabled={inviting}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Users List */}
      {users.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.fullName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {u.email}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {u.role === "owner" ? (
                        <span className={`px-3 py-1 rounded text-xs font-medium ${getRoleColor("owner")}`}>
                          <Shield className="w-3 h-3 inline mr-1" />
                          Owner
                        </span>
                      ) : u.staffRole ? (
                        <span className={`px-3 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800`}>
                          {u.staffRole.name}
                        </span>
                      ) : u.id !== user?.id ? (
                        <select
                          value={u.roleId || ""}
                          onChange={(e) => {
                            const selectedRole = staffRoles.find(r => r.id === Number(e.target.value))
                            if (selectedRole) {
                              handleChangeRole(u.id, selectedRole.name)
                            }
                          }}
                          className="px-3 py-1 rounded text-xs font-medium border-0 cursor-pointer bg-gray-100 text-gray-800"
                        >
                          <option value="">Select role...</option>
                          {staffRoles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded text-xs font-medium ${getRoleColor(u.role || "")}`}>
                          {u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : "N/A"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(u.status)}`}>
                        {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {u.joinedDate ? new Date(u.joinedDate).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        {u.status === "invited" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResendInvitation(u.id)}
                            className="text-blue-600 hover:bg-blue-50"
                            title="Resend invitation"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                        {u.id !== user?.id && u.role !== "owner" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveUser(u.id)}
                            className="text-red-600 hover:bg-red-50"
                            title="Remove user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        {u.status !== "invited" && u.id === user?.id && (
                          <span className="text-xs text-gray-500">Current user</span>
                        )}
                        {u.status !== "invited" && u.id !== user?.id && u.role === "owner" && (
                          <span className="text-xs text-gray-500">Owner</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No team members yet</p>
          {canAddMore && (
            <Button
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Invite First Member
            </Button>
          )}
        </Card>
      )}

      {/* Role Guide */}
      <Card className="p-8 bg-gray-50">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Team Roles</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-purple-600" />
              <p className="font-semibold text-gray-900">Owner</p>
            </div>
            <p className="text-sm text-gray-600 ml-6">Full access to all features and settings</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-blue-600" />
              <p className="font-semibold text-gray-900">Admin</p>
            </div>
            <p className="text-sm text-gray-600 ml-6">Can manage team, products, orders, and settings</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-emerald-600" />
              <p className="font-semibold text-gray-900">Manager</p>
            </div>
            <p className="text-sm text-gray-600 ml-6">Can manage products, orders, and inventory</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-gray-600" />
              <p className="font-semibold text-gray-900">Staff</p>
            </div>
            <p className="text-sm text-gray-600 ml-6">View-only access to dashboards and reports</p>
          </div>
        </div>
      </Card>

      {/* Upgrade Required Modal - User Limit */}
      <UpgradeRequiredModal
        open={isUpgradeModalOpen}
        onOpenChange={setIsUpgradeModalOpen}
        title="Team Member Limit Reached"
        description={`Your current plan allows up to ${maxUsers} team members. Please upgrade to add more.`}
        limitType="users"
        currentLimit={maxUsers}
      />
    </div>
  )
}
