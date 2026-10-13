import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getOptionalUser } from "@/utils/supabase/server";
import { getGenerationQuota } from "@/utils/supabase/journeys";
import { CreateForm } from "./create-form";
export const metadata: Metadata = { title: "Create a journey" };
export const maxDuration = 60;
export default async function CreatePage() {
  if (!await getOptionalUser()) redirect("/?signin=create&next=%2Fcreate");
  const quota = await getGenerationQuota();
  return <main id="main-content" className="create-page"><header className="page-heading"><p className="section-label">A day that only you could invent</p><h1>Start somewhere<br /><span>unexpected.</span></h1><p className="measure">A wild idea, a few real places, and a reason to look twice. Your journey starts as a private draft. You decide what gets published.</p></header><CreateForm initialQuota={quota} /></main>;
}
