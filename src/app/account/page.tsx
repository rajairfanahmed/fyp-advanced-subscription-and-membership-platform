"use client";

import React, { useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { User, Shield, Lock, SlidersHorizontal, LogOut, CheckCircle2, Camera, Trash2, AlertTriangle } from "lucide-react";
import type { NotificationPreferences, UserProfileResponse } from "@/types/profile";

const CONTENT_OPTIONS = ["Video", "Article", "PDF", "ZIP"];
const NOTIFICATION_OPTIONS: Array<{ key: keyof NotificationPreferences; label: string }> = [
  { key: "productUpdates", label: "Product and account updates" },
  { key: "contentDigests", label: "New article and video digests" },
  { key: "downloadAlerts", label: "PDF and ZIP resource alerts" },
  { key: "renewalReminders", label: "Membership renewal reminders" },
];

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  productUpdates: true,
  contentDigests: true,
  downloadAlerts: true,
  renewalReminders: true,
  paymentAlerts: true,
  accountNotices: true,
  creatorAnnouncements: false,
};

export default function AccountPage() {
  const { signOut } = useClerk();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [preferredContentTypes, setPreferredContentTypes] = useState<string[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState(DEFAULT_NOTIFICATIONS);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) throw new Error("Profile could not be loaded.");
        const data = (await res.json()) as { profile: UserProfileResponse | null };
        if (cancelled || !data.profile) return;

        setProfile(data.profile);
        setFullName(data.profile.fullName);
        setDisplayName(data.profile.displayName);
        setPreferredContentTypes(data.profile.subscriberProfile?.preferredContentTypes ?? []);
        setNotificationPreferences({
          ...DEFAULT_NOTIFICATIONS,
          ...(data.profile.subscriberProfile?.notificationPreferences ?? {}),
        });
      } catch {
        if (!cancelled) setError("We could not load your account profile. Please refresh and try again.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.set("fullName", fullName);
      formData.set("displayName", displayName);
      formData.set("preferredContentTypes", JSON.stringify(preferredContentTypes));
      formData.set("notificationPreferences", JSON.stringify(notificationPreferences));
      if (avatarFile) formData.set("avatar", avatarFile);

      const res = await fetch("/api/profile", {
        method: "PATCH",
        body: formData,
      });

      if (!res.ok) throw new Error("Update failed.");
      const data = (await res.json()) as { profile: UserProfileResponse | null };
      if (data.profile) {
        setProfile(data.profile);
        // Re-sync local state from the persisted profile so the UI
        // reflects exactly what the server saved (preferred content
        // types, notification toggles, display name, etc.). This is
        // what makes the chips behave "in real time" — what you see
        // on screen always matches the database.
        setFullName(data.profile.fullName);
        setDisplayName(data.profile.displayName);
        setPreferredContentTypes(
          data.profile.subscriberProfile?.preferredContentTypes ?? []
        );
        setNotificationPreferences({
          ...DEFAULT_NOTIFICATIONS,
          ...(data.profile.subscriberProfile?.notificationPreferences ?? {}),
        });
      }
      setAvatarFile(null);
      setMessage("Profile saved successfully.");
    } catch {
      setError("We could not save your profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const avatarSource = avatarPreview || profile?.avatarUrl || "";

  function toggleContentType(value: string) {
    setPreferredContentTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function toggleNotification(key: keyof NotificationPreferences) {
    setNotificationPreferences((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account?confirm=DELETE", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        let body: { error?: string } = {};
        try {
          body = await res.json();
        } catch {
          body = {};
        }
        throw new Error(body.error || `Account deletion failed (HTTP ${res.status}).`);
      }
      // Account is gone — Clerk session is dead too. Redirect to a
      // friendly farewell screen (the home page).
      window.location.href = "/?account_deleted=1";
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Account deletion failed.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">
      <section className="mb-12 relative">
        <div className="absolute top-0 right-1/4 w-[40vw] h-[40vw] bg-violet-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />
        <Container className="max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem className="mb-4">
              <Badge variant="default">Account Settings</Badge>
            </MotionItem>
            <MotionItem>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.1] mb-4">
                Profile & <span className="text-gradient-primary">Preferences</span>
              </h1>
            </MotionItem>
            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] font-medium max-w-2xl leading-relaxed">
                Manage your profile, content preferences, and account information safely.
              </p>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

      <Container className="max-w-5xl">
        {isLoading ? (
          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 text-sm font-bold text-slate-500">
            Loading account profile...
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
              <MotionReveal>
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black font-display text-[var(--color-ink)]">Profile Details</h2>
                      <p className="text-sm text-slate-500 font-medium">Update your public identity and preferences.</p>
                    </div>
                  </div>

                  <form className="p-8 space-y-6" onSubmit={handleProfileSubmit}>
                    {(error || message) && (
                      <div className={`p-4 rounded-xl text-sm font-bold border ${error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                        {error || message}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5 rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                      <div className="w-20 h-20 rounded-full bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        {avatarSource ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarSource} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <Camera className="w-4 h-4 text-slate-400" />
                          Profile Avatar
                        </label>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
                          onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                          className="w-full text-sm font-medium text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-slate-700 hover:file:bg-slate-100"
                        />
                        <p className="text-xs font-medium text-slate-400">JPG, PNG, WEBP, or AVIF. Stored in Cloudflare R2 after saving.</p>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Full Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-[var(--color-ink)]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Display Name</label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-[var(--color-ink)]"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Email Address</label>
                        <input
                          type="email"
                          value={profile?.email ?? ""}
                          disabled
                          className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-500 cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Role</label>
                        <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-500 cursor-not-allowed flex items-center justify-between capitalize">
                          {profile?.role ?? "subscriber"}
                          <Lock className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">Preferred Content Types</label>
                      <div className="flex flex-wrap gap-3">
                        {CONTENT_OPTIONS.map((item) => (
                          <label key={item} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={preferredContentTypes.includes(item)}
                              onChange={() => toggleContentType(item)}
                              className="accent-emerald-500"
                            />
                            {item}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button type="submit" variant="primary" disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save Profile"}
                      </Button>
                    </div>
                  </form>
                </div>
              </MotionReveal>

              <MotionReveal>
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black font-display text-[var(--color-ink)]">Security & Password</h2>
                      <p className="text-sm text-slate-500 font-medium">Clerk handles passwords, Google login, and verification for this account.</p>
                    </div>
                  </div>

                  <div className="p-8 flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-slate-600">Use the password reset flow if you need to change your password.</p>
                    <Button variant="secondary" href="/forgot-password">Reset Password</Button>
                  </div>
                </div>
              </MotionReveal>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <MotionReveal className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <SlidersHorizontal className="w-5 h-5 text-[var(--color-ink)]" />
                    <h3 className="text-lg font-black font-display text-[var(--color-ink)]">Notifications</h3>
                  </div>

                  <div className="space-y-4">
                    {NOTIFICATION_OPTIONS.map((pref) => (
                      <label key={pref.key} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={notificationPreferences[pref.key]}
                            onChange={() => toggleNotification(pref.key)}
                            className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 checked:bg-emerald-500 checked:border-emerald-500 transition-colors cursor-pointer"
                          />
                          <CheckCircle2 className="w-3.5 h-3.5 text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                        </div>
                        <span className="text-sm font-medium text-slate-700 select-none">{pref.label}</span>
                      </label>
                    ))}
                    <div className="pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={(e) => handleProfileSubmit(e as unknown as React.FormEvent)}
                        disabled={isSaving}
                      >
                        Save Preferences
                      </Button>
                    </div>
                  </div>
                </div>
              </MotionReveal>

              <MotionReveal>
                <div className="bg-white border border-slate-200 rounded-[2rem] p-8">
                  <h3 className="text-lg font-black font-display text-slate-900 mb-3">Session</h3>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed mb-6">
                    Log out of this browser. You can sign back in from the login page.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    icon={<LogOut className="w-4 h-4 ml-1" />}
                    onClick={() => signOut({ redirectUrl: "/login" })}
                  >
                    Log Out
                  </Button>
                </div>
              </MotionReveal>

              <MotionReveal>
                <div className="bg-red-50 border border-red-200 rounded-[2rem] p-8">
                  <h3 className="text-lg font-black font-display text-red-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Danger Zone
                  </h3>
                  <p className="text-sm text-red-800 font-medium leading-relaxed mb-2">
                    Delete your account permanently. This will:
                  </p>
                  <ul className="text-xs text-red-800 font-medium leading-relaxed mb-6 list-disc pl-5 space-y-1">
                    <li>Cancel every active subscription on Stripe.</li>
                    <li>Erase your profile, avatar, and notification preferences.</li>
                    <li>Remove your Clerk login.</li>
                  </ul>
                  <Button
                    variant="outline"
                    className="w-full bg-white text-red-700 border-red-300 hover:bg-red-100"
                    icon={<Trash2 className="w-4 h-4 ml-1" />}
                    onClick={() => {
                      setShowDeleteDialog(true);
                      setDeleteConfirmText("");
                      setDeleteError("");
                    }}
                  >
                    Delete Account
                  </Button>
                </div>
              </MotionReveal>
            </div>
          </div>
        )}
      </Container>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-black font-display text-slate-950">Delete account permanently?</h2>
            </div>
            <p className="text-sm font-medium text-slate-700 leading-relaxed mb-2">
              This action is irreversible. Your subscriptions will be cancelled, your profile data will be removed, and your Clerk login will be deleted.
            </p>
            <p className="text-sm font-medium text-slate-700 leading-relaxed mb-4">
              Type <span className="font-black text-red-700">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-red-400 focus:outline-none font-bold text-slate-900 mb-3"
              autoFocus
              disabled={isDeleting}
            />
            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 !bg-red-600 hover:!bg-red-700"
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== "DELETE"}
              >
                {isDeleting ? "Deleting..." : "Delete forever"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
