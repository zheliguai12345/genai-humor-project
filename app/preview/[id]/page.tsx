import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getOptionalUser } from "@/utils/supabase/server";
import { getOwnDraft } from "@/utils/supabase/journeys";
import { JourneyAuthError, JourneyInputError } from "@/utils/journeys/validation";
import { PreviewEditor } from "./preview-editor";
export const metadata: Metadata = { title: "Preview your journey", robots: { index: false, follow: false } };
export const maxDuration = 120;
export default async function PreviewPage({ params }: PageProps<"/preview/[id]">) {
  const { id } = await params;
  if (!await getOptionalUser()) redirect(`/?signin=preview&next=${encodeURIComponent(`/preview/${id}`)}`);
  let journey;
  try { journey = await getOwnDraft(id); }
  catch (error) {
    if (error instanceof JourneyInputError) notFound();
    if (error instanceof JourneyAuthError) redirect("/?signin=preview");
    throw error;
  }
  if (!journey) notFound();
  return <main id="main-content" className="journey-page preview-editor"><PreviewEditor journey={journey} /></main>;
}
