"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CreatorShell } from "@/components/dashboard/CreatorShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { User, Settings2, BellRing, ShieldAlert, Camera, ImageIcon, UploadCloud, KeyRound, Trash2, AlertTriangle } from "lucide-react";
import type { CreatorProfileResponse, CreatorProfileStatus, CreatorWorkspaceAlerts, CreatorWorkspaceDefaults } from "@/types/profile";

const NOTIFICATION_PREFS = [
  "New subscriber alerts",
  "Billing summaries",
  "Failed payment alerts",
  "Content engagement reports",
  "Weekly revenue summary",
] as const;

const CREATOR_ALERT_FIELD_ORDER: (keyof CreatorWorkspaceAlerts)[] = [
  "newSubscriber",
  "renewalSummary",
  "failedPayment",
  "engagementReport",
  "weeklyRevenue",
];

const DEFAULT_ALERT_PREFS_ORDERED = CREATOR_ALERT_FIELD_ORDER.map((_, index) => index !== 2);

function UploadCard({
  title,
  helper,
  file,
  onChange,
}: {
  title: string;
  helper: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block rounded-2xl border-2 border-dashed border-slate-300 bg-white px-5 py-4 cursor-pointer hover:border-teal-500 hover:bg-teal-50/40 active:bg-teal-50/60 transition-colors focus-within:ring-2 focus-within:ring-teal-500/30 touch-manipulation">
      <input
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
          <UploadCloud className="w-5 h-5 text-teal-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">{file ? file.name : title}</p>
          <p className="text-xs font-bold text-slate-600 mt-1">{helper}</p>
        </div>
      </div>
    </label>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<CreatorProfileResponse | null>(null);
  const [creatorName, setCreatorName] = useState("");
  const [creatorSlug, setCreatorSlug] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [profileStatus, setProfileStatus] = useState<CreatorProfileStatus>("draft");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [alertPrefs, setAlertPrefs] = useState<boolean[]>(() => [...DEFAULT_ALERT_PREFS_ORDERED]);
  const [alertSaving, setAlertSaving] = useState(false);
  const [workspaceDefaults, setWorkspaceDefaults] = useState<CreatorWorkspaceDefaults>({
    defaultRequiredPlan: "basic",
    defaultStatus: "draft",
  });
  const [defaultsSaving, setDefaultsSaving] = useState(false);
  const [defaultsMessage, setDefaultsMessage] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDeleteWorkspace() {
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
        throw new Error(body.error || `Workspace deletion failed (HTTP ${res.status}).`);
      }
      window.location.href = "/?account_deleted=1";
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Workspace deletion failed.");
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const res = await fetch("/api/creator-profile", { cache: "no-store" });
        if (!res.ok) throw new Error("Creator profile unavailable.");
        const data = (await res.json()) as { profile: CreatorProfileResponse };
        if (cancelled) return;

        setProfile(data.profile);
        setCreatorName(data.profile.creatorName);
        setCreatorSlug(data.profile.creatorSlug);
        setBio(data.profile.bio);
        setAvatarUrl(data.profile.avatarUrl);
        setBannerUrl(data.profile.bannerUrl);
        setProfileStatus(data.profile.profileStatus);
        setAlertPrefs(CREATOR_ALERT_FIELD_ORDER.map((k) => data.profile.creatorWorkspaceAlerts[k]));
        setWorkspaceDefaults(data.profile.workspaceDefaults);
      } catch {
        if (!cancelled) setError("Creator profile could not be loaded. Make sure this signed-in account has the creator role.");
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

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(bannerFile);
    setBannerPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [bannerFile]);

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.set("creatorName", creatorName);
      formData.set("creatorSlug", creatorSlug);
      formData.set("bio", bio);
      formData.set("profileStatus", profileStatus);
      if (avatarFile) formData.set("avatar", avatarFile);
      if (bannerFile) formData.set("banner", bannerFile);

      const res = await fetch("/api/creator-profile", {
        method: "PATCH",
        body: formData,
      });

      if (!res.ok) throw new Error("Update failed.");
      const data = (await res.json()) as { profile: CreatorProfileResponse };
      setProfile(data.profile);
      setCreatorName(data.profile.creatorName);
      setCreatorSlug(data.profile.creatorSlug);
      setBio(data.profile.bio);
      setAvatarUrl(data.profile.avatarUrl);
      setBannerUrl(data.profile.bannerUrl);
      setProfileStatus(data.profile.profileStatus);
      setAlertPrefs(CREATOR_ALERT_FIELD_ORDER.map((k) => data.profile.creatorWorkspaceAlerts[k]));
      setWorkspaceDefaults(data.profile.workspaceDefaults);
      setAvatarFile(null);
      setBannerFile(null);
      setMessage("Creator profile saved successfully.");
    } catch {
      setError("Creator profile could not be saved. Please try a different slug or refresh and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function persistWorkspaceAlert(index: number) {
    if (!profile || alertSaving) return;
    const key = CREATOR_ALERT_FIELD_ORDER[index];
    const nextAlerts: CreatorWorkspaceAlerts = {
      ...profile.creatorWorkspaceAlerts,
      [key]: !alertPrefs[index],
    };
    setAlertSaving(true);
    setError("");
    try {
      const res = await fetch("/api/creator-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorWorkspaceAlerts: nextAlerts }),
      });
      if (!res.ok) throw new Error("Update failed");
      const data = (await res.json()) as { profile: CreatorProfileResponse };
      setProfile(data.profile);
      setAlertPrefs(CREATOR_ALERT_FIELD_ORDER.map((k) => data.profile.creatorWorkspaceAlerts[k]));
    } catch {
      setError("Alert preferences could not be saved. Please try again.");
    } finally {
      setAlertSaving(false);
    }
  }

  async function persistWorkspaceDefaults(next: CreatorWorkspaceDefaults) {
    if (!profile || defaultsSaving) return;
    setDefaultsSaving(true);
    setDefaultsMessage("");
    setError("");
    try {
      const res = await fetch("/api/creator-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceDefaults: next }),
      });
      if (!res.ok) throw new Error("Update failed");
      const data = (await res.json()) as { profile: CreatorProfileResponse };
      setProfile(data.profile);
      setWorkspaceDefaults(data.profile.workspaceDefaults);
      setDefaultsMessage("Workspace defaults saved.");
    } catch {
      setError("Workspace defaults could not be saved. Please try again.");
    } finally {
      setDefaultsSaving(false);
    }
  }

  const initials = creatorName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CR";
  const avatarSource = avatarPreview || avatarUrl;
  const bannerSource = bannerPreview || bannerUrl;
  const fieldClass = "w-full px-5 py-4 bg-white border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all font-bold text-slate-950 placeholder:text-slate-500";
  const labelClass = "text-[11px] font-black text-slate-700 uppercase tracking-[0.2em]";

  return (
    <CreatorShell>
      <div className="space-y-12 pb-10">
        <DashboardHeader
          eyebrow="Configuration"
          title="Creator Settings"
          subtitle="Manage creator profile, workspace preferences, content defaults, and notification settings."
          action={
            <Button variant="primary" className="h-14 px-8 rounded-2xl" onClick={(e) => handleFormSubmit(e as unknown as React.FormEvent)}>
              {isSaving ? "Saving..." : "Save All Changes"}
            </Button>
          }
        />

        {isLoading ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 text-sm font-bold text-slate-600">
            Loading creator profile...
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
              <MotionReveal className="space-y-10">
                {profileStatus === "draft" && (
                  <div
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-5 md:p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
                    role="status"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-amber-950 mb-1">
                        You are not visible on Browse Creators
                      </p>
                      <p className="text-sm font-medium text-amber-900/90 max-w-2xl">
                        Draft profiles stay private. Switch to{" "}
                        <span className="font-bold">Published</span> so subscribers can find you on{" "}
                        <Link
                          href="/creators"
                          className="font-bold underline decoration-amber-700/50"
                        >
                          /creators
                        </Link>
                        .
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      className="h-11 px-5 rounded-xl text-xs shrink-0"
                      onClick={() => {
                        setProfileStatus("published");
                        setMessage("");
                        setError("");
                      }}
                    >
                      Switch to Published
                    </Button>
                  </div>
                )}
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-10 border-b border-slate-50 flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                      <User className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black font-display text-slate-900 leading-tight">Creator Profile</h2>
                      <p className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-widest opacity-90">Public Identity</p>
                    </div>
                  </div>

                  <form className="p-10 space-y-8" onSubmit={handleFormSubmit}>
                    {(error || message) && (
                      <div className={`p-4 rounded-xl text-sm font-bold border ${error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                        {error || message}
                      </div>
                    )}

                    <div className="flex items-center gap-8">
                      <div className="w-24 h-24 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 relative overflow-hidden group shadow-inner">
                        {avatarSource ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarSource} alt={`${creatorName || "Creator"} avatar`} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-black text-3xl font-display text-slate-300">{initials}</span>
                        )}
                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                          <Camera className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <label className={labelClass}>Creator Avatar</label>
                        <UploadCard
                          title="Click to upload or drag creator avatar here"
                          helper="Allowed image types: JPG, JPEG, PNG, WEBP, AVIF."
                          file={avatarFile}
                          onChange={setAvatarFile}
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className={labelClass}>Creator Name</label>
                        <input
                          type="text"
                          value={creatorName}
                          onChange={(e) => setCreatorName(e.target.value)}
                          className={fieldClass}
                        />
                      </div>
                      <div className="space-y-3">
                        <label className={labelClass}>Creator Slug</label>
                        <input
                          type="text"
                          value={creatorSlug}
                          onChange={(e) => setCreatorSlug(e.target.value)}
                          className={fieldClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className={labelClass}>Creator Bio</label>
                      <textarea
                        rows={4}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className={`${fieldClass} resize-none font-medium`}
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className={labelClass}>Creator Banner</label>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                          <div className="h-24 bg-white flex items-center justify-center overflow-hidden">
                            {bannerSource ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={bannerSource} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-slate-300" />
                            )}
                          </div>
                          <div className="p-4">
                            <UploadCard
                              title="Click to upload or drag creator banner here"
                              helper="Allowed image types: JPG, JPEG, PNG, WEBP, AVIF."
                              file={bannerFile}
                              onChange={setBannerFile}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className={labelClass}>Profile Status</label>
                        <select
                          value={profileStatus}
                          onChange={(e) => setProfileStatus(e.target.value as CreatorProfileStatus)}
                          className={`${fieldClass} appearance-none`}
                          aria-describedby="profile-status-help"
                        >
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                        </select>
                        <p id="profile-status-help" className="text-xs font-medium text-slate-600 leading-relaxed">
                          <span className="font-bold text-slate-800">Draft</span> keeps your profile off the public directory.{" "}
                          <span className="font-bold text-slate-800">Published</span> lists you on /creators and your public page.
                        </p>
                      </div>
                    </div>

                    <div className="pt-6 flex justify-between items-center border-t border-slate-50">
                      <p className="text-xs font-bold text-slate-600">
                        Public URL: /creators/{profile?.creatorSlug || creatorSlug || "your-slug"}
                      </p>
                      <Button type="submit" variant="secondary" className="h-12 px-6 rounded-xl text-xs" disabled={isSaving}>
                        {isSaving ? "Saving..." : "Update Profile"}
                      </Button>
                    </div>
                  </form>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-10 border-b border-slate-50 flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                      <Settings2 className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black font-display text-slate-900 leading-tight">Workspace Defaults</h2>
                      <p className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-widest opacity-90">Pre-fill the Create Content form</p>
                    </div>
                  </div>
                  <div className="p-10 space-y-6">
                    {defaultsMessage && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                        {defaultsMessage}
                      </div>
                    )}
                    <p className="text-sm font-medium text-slate-600 leading-relaxed">
                      These values pre-fill the access tier and visibility on every new piece of content you create. You can still override them per upload.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className={labelClass}>Default Access Tier</label>
                        <select
                          value={workspaceDefaults.defaultRequiredPlan}
                          onChange={(e) =>
                            setWorkspaceDefaults((cur) => ({
                              ...cur,
                              defaultRequiredPlan: e.target.value as CreatorWorkspaceDefaults["defaultRequiredPlan"],
                            }))
                          }
                          className={`${fieldClass} appearance-none`}
                          disabled={defaultsSaving || isLoading}
                        >
                          <option value="free">Free (Public)</option>
                          <option value="basic">Basic Plan</option>
                          <option value="premium">Premium Plan</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className={labelClass}>Default Visibility</label>
                        <select
                          value={workspaceDefaults.defaultStatus}
                          onChange={(e) =>
                            setWorkspaceDefaults((cur) => ({
                              ...cur,
                              defaultStatus: e.target.value as CreatorWorkspaceDefaults["defaultStatus"],
                            }))
                          }
                          className={`${fieldClass} appearance-none`}
                          disabled={defaultsSaving || isLoading}
                        >
                          <option value="draft">Draft</option>
                          <option value="published">Public</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-12 px-6 rounded-xl text-xs"
                        onClick={() => void persistWorkspaceDefaults(workspaceDefaults)}
                        disabled={defaultsSaving || isLoading}
                      >
                        {defaultsSaving ? "Saving…" : "Save Defaults"}
                      </Button>
                    </div>
                  </div>
                </div>
              </MotionReveal>
            </div>

            <div className="lg:col-span-1 space-y-10">
              <MotionReveal className="sticky top-24 space-y-10">
                <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center shrink-0 border border-teal-100">
                      <BellRing className="w-6 h-6 text-teal-600" />
                    </div>
                    <h3 className="text-lg font-black font-display text-slate-900 leading-tight uppercase tracking-tight">Alerts</h3>
                  </div>
                  {alertSaving && (
                    <p className="text-xs font-bold text-teal-700 mb-4" role="status">
                      Saving preferences…
                    </p>
                  )}

                  <div className="space-y-6">
                    {NOTIFICATION_PREFS.map((pref, i) => (
                      <div key={pref} className="flex justify-between items-center gap-6">
                        <span className="text-[13px] font-bold text-slate-600 leading-snug">{pref}</span>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={alertPrefs[i]}
                            disabled={alertSaving || isLoading}
                            onChange={() => {
                              void persistWorkspaceAlert(i);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500 shadow-inner"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200">
                      <ShieldAlert className="w-6 h-6 text-slate-500" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">Security</h3>
                  </div>
                  <p className="text-[13px] font-medium text-slate-600 leading-relaxed mb-6">
                    Passwords are managed by Clerk. Use the password reset flow to change your sign-in credentials.
                  </p>
                  <div className="space-y-3">
                    <Button
                      href="/forgot-password"
                      variant="secondary"
                      className="w-full h-12 rounded-xl text-xs"
                      icon={<KeyRound className="w-4 h-4 ml-1" />}
                    >
                      Change password
                    </Button>
                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                      A reset code will be emailed to your account&apos;s primary email address.
                    </p>
                  </div>
                </div>

                <div className="bg-red-50 rounded-[2.5rem] border border-red-200 p-10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0 border border-red-200">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="text-lg font-black text-red-900 uppercase tracking-tight leading-none">
                      Delete Workspace
                    </h3>
                  </div>
                  <p className="text-[13px] font-medium text-red-900 leading-relaxed mb-3">
                    Permanently remove this creator workspace. We will:
                  </p>
                  <ul className="text-[12px] font-medium text-red-900 leading-relaxed mb-6 list-disc pl-5 space-y-1">
                    <li>Cancel every active subscription on Stripe.</li>
                    <li>Archive your Stripe products and prices.</li>
                    <li>Delete every piece of content and its files in Cloudflare R2.</li>
                    <li>Delete every plan you&apos;ve created.</li>
                    <li>Erase your creator profile (avatar, banner) and account.</li>
                  </ul>
                  <p className="text-[12px] font-bold text-red-900 mb-4">
                    This action cannot be undone.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl text-xs bg-white text-red-700 border-red-300 hover:bg-red-100"
                    icon={<Trash2 className="w-4 h-4 ml-1" />}
                    onClick={() => {
                      setShowDeleteDialog(true);
                      setDeleteConfirmText("");
                      setDeleteError("");
                    }}
                  >
                    Delete workspace permanently
                  </Button>
                </div>
              </MotionReveal>
            </div>
          </div>
        )}
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-black font-display text-slate-950">Delete creator workspace?</h2>
            </div>
            <p className="text-sm font-medium text-slate-700 leading-relaxed mb-2">
              This will cancel every Stripe subscription tied to your workspace, archive your Stripe products, delete every content row + R2 asset, delete every plan, and remove your Clerk login. The action is irreversible.
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
                onClick={handleDeleteWorkspace}
                disabled={isDeleting || deleteConfirmText !== "DELETE"}
              >
                {isDeleting ? "Deleting..." : "Delete forever"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </CreatorShell>
  );
}
