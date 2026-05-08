import { ContentForm } from "@/components/forms/ContentForm";
import { getCurrentCreatorProfileResponse } from "@/lib/auth/profile-sync";

/**
 * Server component — fetch the creator's workspace defaults at render
 * time so the form opens with the saved tier/visibility on the very
 * first paint. Without this we'd briefly show "basic / draft" before
 * the client useEffect swapped them in, which is what the creator was
 * seeing as "workspace defaults aren't real-time".
 */
export const dynamic = "force-dynamic";

export default async function CreateContentPage() {
  let workspaceDefaults: { defaultRequiredPlan: "free" | "basic" | "premium"; defaultStatus: "draft" | "published" } | null = null;
  try {
    const profile = await getCurrentCreatorProfileResponse();
    if (profile?.workspaceDefaults) {
      workspaceDefaults = profile.workspaceDefaults;
    }
  } catch {
    workspaceDefaults = null;
  }

  return <ContentForm mode="create" workspaceDefaults={workspaceDefaults} />;
}
