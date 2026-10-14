"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl, requestApi } from "../lib/api";
import type {
  LoginUserData,
  PaginatedResult,
  SubscriptionData,
  TenantData,
  UserData,
} from "../types";

type DashboardMode = "globalOwner" | "tenantUser";

async function tryGetGlobalDashboardData() {
  return requestApi<PaginatedResult<TenantData>>("/platform-admin/tenants?page=1&pageSize=20");
}

async function tryGetTenantUsersData() {
  return requestApi<PaginatedResult<UserData>>("/users?page=1&pageSize=20");
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<LoginUserData | null>(null);
  const [mode, setMode] = useState<DashboardMode | null>(null);
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionData["plan"]>("TRIAL");
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionData["status"]>("TRIAL");
  const [periodEnd, setPeriodEnd] = useState("");
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [orgPlan, setOrgPlan] = useState("TRIAL");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants],
  );

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const currentUser = await requestApi<LoginUserData>("/auth/me");
        setMe(currentUser);

        if (currentUser.isGlobalAdmin) {
          const globalData = await tryGetGlobalDashboardData();
          const customerTenants = globalData.items.filter(
            (tenant) => tenant.id !== currentUser.tenantId,
          );
          setMode("globalOwner");
          setTenants(customerTenants);
          setSelectedTenantId(customerTenants[0]?.id ?? "");
        } else {
          const tenantData = await tryGetTenantUsersData();
          setMode("tenantUser");
          setTenantUsers(tenantData.items);
        }
      } catch (error: unknown) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not load session. Please log in first.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!selectedTenantId || mode !== "globalOwner") {
      return;
    }

    const loadTenantUsers = async () => {
      try {
        setFeedback(null);
        const result = await requestApi<PaginatedResult<UserData>>(
          `/platform-admin/tenants/${selectedTenantId}/users?page=1&pageSize=20`,
        );
        setTenantUsers(result.items);
      } catch (error: unknown) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load tenant users",
        );
      }
    };

    void loadTenantUsers();
  }, [mode, selectedTenantId]);

  useEffect(() => {
    if (!selectedTenantId || mode !== "globalOwner") {
      setSubscription(null);
      return;
    }

    const loadSubscription = async () => {
      try {
        const data = await requestApi<SubscriptionData>(
          `/platform-admin/tenants/${selectedTenantId}/subscription`,
        );
        setSubscription(data);
        setSubscriptionPlan(data.plan);
        setSubscriptionStatus(data.status);
        setPeriodEnd(data.currentPeriodEnd?.slice(0, 10) ?? "");
      } catch (error: unknown) {
        setSubscription(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load subscription",
        );
      }
    };

    void loadSubscription();
  }, [mode, selectedTenantId]);

  const handleLogout = async () => {
    setFeedback(null);
    setErrorMessage(null);

    try {
      await requestApi<{ message: string }>("/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Logout failed");
    }
  };

  const reloadTenants = async () => {
    const data = await tryGetGlobalDashboardData();
    const customerTenants = data.items.filter(
      (tenant) => tenant.id !== me?.tenantId,
    );
    setTenants(customerTenants);
    return customerTenants;
  };

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreatingOrg(true);
    setErrorMessage(null);
    setFeedback(null);

    try {
      const created = await requestApi<{ tenant: TenantData; subscription: SubscriptionData }>("/platform-admin/tenants", {
        method: "POST",
        body: JSON.stringify({
          name: orgName.trim(),
          slug: orgSlug.trim(),
          ownerEmail: ownerEmail.trim(),
          ownerDisplayName: ownerName.trim(),
          plan: orgPlan,
        }),
      });
      setOrgName("");
      setOrgSlug("");
      setOwnerEmail("");
      setOwnerName("");
      const items = await reloadTenants();
      if (created.tenant?.id) setSelectedTenantId(created.tenant.id);
      else if (items[0]) setSelectedTenantId(items[0].id);
      setFeedback("Organization created. An owner invitation email was sent.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Create organization failed");
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const changeTenantStatus = async (status: TenantData["status"]) => {
    if (!selectedTenantId) return;
    setErrorMessage(null);
    setFeedback(null);
    try {
      await requestApi(`/platform-admin/tenants/${selectedTenantId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await reloadTenants();
      setFeedback(`Organization status set to ${status}.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Status update failed");
    }
  };

  const resendOwnerInvite = async () => {
    if (!selectedTenantId) return;
    if (!inviteEmail.trim() || !inviteName.trim()) {
      setErrorMessage("Enter the owner's name and email before sending an invite.");
      return;
    }
    setErrorMessage(null);
    setFeedback(null);
    try {
      await requestApi(`/platform-admin/tenants/${selectedTenantId}/owner-invite`, {
        method: "POST",
        body: JSON.stringify({
          ownerEmail: inviteEmail.trim(),
          ownerDisplayName: inviteName.trim(),
        }),
      });
      setFeedback("Owner invitation sent.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Invite failed");
    }
  };

  const updateSubscription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId) return;
    setErrorMessage(null);
    setFeedback(null);
    try {
      const updated = await requestApi<SubscriptionData>(
        `/platform-admin/tenants/${selectedTenantId}/subscription`,
        {
          method: "PATCH",
          body: JSON.stringify({
            plan: subscriptionPlan,
            status: subscriptionStatus,
            currentPeriodEnd: periodEnd
              ? new Date(`${periodEnd}T23:59:59.000Z`).toISOString()
              : undefined,
          }),
        },
      );
      setSubscription(updated);
      setFeedback("Subscription updated.");
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Subscription update failed",
      );
    }
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreatingUser(true);
    setErrorMessage(null);
    setFeedback(null);

    try {
      await requestApi<{ id: string; email: string; displayName: string; isManager: boolean }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            password,
            displayName: displayName.trim(),
            tenantId:
              mode === "globalOwner" && selectedTenantId
                ? selectedTenantId
                : undefined,
          }),
        },
      );

      setEmail("");
      setPassword("");
      setDisplayName("");
      setFeedback("User created. Verification email should be sent by the backend.");

      if (mode === "globalOwner" && selectedTenantId) {
        const refreshed = await requestApi<PaginatedResult<UserData>>(
          `/platform-admin/tenants/${selectedTenantId}/users?page=1&pageSize=20`,
        );
        setTenantUsers(refreshed.items);
      } else {
        const refreshed = await tryGetTenantUsersData();
        setTenantUsers(refreshed.items);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Create user failed");
    } finally {
      setIsCreatingUser(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-700">
        Loading dashboard...
      </div>
    );
  }

  if (errorMessage && !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
        <main className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-900">Dashboard unavailable</h1>
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </p>
          <a className="mt-5 inline-block text-sm underline" href="/login">
            Go to login
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold">
              {mode === "globalOwner" ? "Platform Admin Dashboard" : "Organization Dashboard"}
            </h1>
            <p className="text-sm text-zinc-600">
              Signed in as {me?.displayName} ({me?.email})
            </p>
            <p className="text-xs text-zinc-500">API: {getApiBaseUrl()}</p>
          </div>
          <button
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
        </header>

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
        {feedback ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {feedback}
          </p>
        ) : null}

        {mode === "globalOwner" ? (
          <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Customer organizations</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Manage customer organizations and their subscriptions. Your platform organization is hidden.
              </p>
              <select
                className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={selectedTenantId}
                onChange={(event) => setSelectedTenantId(event.target.value)}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug}) - {tenant.status}
                  </option>
                ))}
              </select>
              <p className="mt-3 text-xs text-zinc-500">
                Selected organization: {selectedTenant?.name ?? "None"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["ACTIVE", "TRIAL", "SUSPENDED", "ARCHIVED"] as const).map((status) => (
                  <button
                    key={status}
                    className="rounded-lg border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100"
                    type="button"
                    onClick={() => void changeTenantStatus(status)}
                  >
                    Set {status}
                  </button>
                ))}
              </div>

              <h3 className="mt-5 text-sm font-semibold">Send or resend owner invite</h3>
              <div className="mt-2 space-y-2">
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Owner display name"
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Owner email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
                <button
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
                  type="button"
                  onClick={() => void resendOwnerInvite()}
                >
                  Send owner invite
                </button>
              </div>

              <h3 className="mt-5 text-sm font-semibold">Subscription</h3>
              {subscription ? (
                <form className="mt-2 space-y-2" onSubmit={updateSubscription}>
                  <p className="text-xs text-zinc-600">
                    Current: {subscription.plan} / {subscription.status}
                  </p>
                  <select
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    value={subscriptionPlan}
                    onChange={(event) =>
                      setSubscriptionPlan(event.target.value as SubscriptionData["plan"])
                    }
                  >
                    {["TRIAL", "STARTER", "GROWTH", "ENTERPRISE"].map((plan) => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    value={subscriptionStatus}
                    onChange={(event) =>
                      setSubscriptionStatus(event.target.value as SubscriptionData["status"])
                    }
                  >
                    {["TRIAL", "ACTIVE", "PAST_DUE", "CANCELED", "INCOMPLETE"].map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <label className="block text-xs text-zinc-600">
                    Period end
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      type="date"
                      value={periodEnd}
                      onChange={(event) => setPeriodEnd(event.target.value)}
                    />
                  </label>
                  <button
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                    type="submit"
                  >
                    Save subscription
                  </button>
                </form>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">
                  {selectedTenantId ? "No subscription data available." : "Select an organization to manage its subscription."}
                </p>
              )}

              <h3 className="mt-6 text-sm font-semibold">Create organization + invite owner</h3>
              <form className="mt-3 space-y-2" onSubmit={createOrganization}>
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Organization name"
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                  required
                />
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Slug (e.g. acme)"
                  value={orgSlug}
                  onChange={(event) => setOrgSlug(event.target.value)}
                  required
                />
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Owner display name"
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                  required
                />
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Owner email"
                  type="email"
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  required
                />
                <select
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  value={orgPlan}
                  onChange={(event) => setOrgPlan(event.target.value)}
                >
                  {["TRIAL", "STARTER", "GROWTH", "ENTERPRISE"].map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                  type="submit"
                  disabled={isCreatingOrg}
                >
                  {isCreatingOrg ? "Creating..." : "Create organization"}
                </button>
              </form>
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Add user to selected organization</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Uses <code>/auth/register</code> on the backend.
              </p>
              <form className="mt-4 space-y-3" onSubmit={createUser}>
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Temporary password"
                  type="password"
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={isCreatingUser}
                >
                  {isCreatingUser ? "Creating..." : "Create user"}
                </button>
              </form>
            </article>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Your organization</h2>
              <p className="mt-1 text-sm text-zinc-600">
                You are signed in to and manage your own organization.
              </p>
              <p className="mt-3 break-all text-xs text-zinc-500">
                Organization ID: {me?.tenantId}
              </p>
            </article>
            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Add user</h2>
              <p className="mt-1 text-sm text-zinc-600">
                New users are added to your organization.
              </p>
              <form className="mt-4 space-y-3" onSubmit={createUser}>
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Temporary password"
                  type="password"
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                  type="submit"
                  disabled={isCreatingUser}
                >
                  {isCreatingUser ? "Creating..." : "Create user"}
                </button>
              </form>
            </article>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Showing up to 20 users from the selected context.
          </p>
          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-600">
                  <th className="px-2 py-2">Display Name</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Manager</th>
                  <th className="px-2 py-2">Verified</th>
                </tr>
              </thead>
              <tbody>
                {tenantUsers.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-100">
                    <td className="px-2 py-2">{user.displayName}</td>
                    <td className="px-2 py-2">{user.email}</td>
                    <td className="px-2 py-2">{user.isManager ? "Yes" : "No"}</td>
                    <td className="px-2 py-2">{user.emailVerifiedAt ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {tenantUsers.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-zinc-500" colSpan={4}>
                      No users available in the current context.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
