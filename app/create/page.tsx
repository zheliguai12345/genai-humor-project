import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getOptionalUser } from "@/utils/supabase/server";
import { getGenerationQuota } from "@/utils/supabase/journeys";
import { CreateForm } from "./create-form";
export const metadata: Metadata = { title: "Create a journey" };
export const maxDuration = 120;
export default async function CreatePage() {
  if (!await getOptionalUser()) redirect("/?signin=create&next=%2Fcreate");
  const quota = await getGenerationQuota();
  return <main id="main-content" className="create-page"><h1>Create a journey.</h1><CreateForm initialQuota={quota} /></main>;
}
