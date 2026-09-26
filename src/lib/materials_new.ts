// 강의자료 PDF를 Gemini에 넘길 준비를 한다. 서버에서만 쓴다.
import "server-only";
import type { createClient } from "@/lib/supabase/server_new";
import { uploadFile, type GeminiFile } from "@/lib/gemini_new";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const MATERIALS_BUCKET = "materials";
const REUPLOAD_MARGIN_MS = 10 * 60_000; // 만료 10분 전이면 새로 올린다

export type MaterialRow = {
  id: string;
  name: string;
  path: string;
  gemini_uri: string | null;
  gemini_expires_at: string | null;
};

// Gemini에 올려 둔 파일이 살아 있으면 그대로 쓰고, 없거나 곧 만료되면 Storage에서 받아 다시 올린다.
export async function geminiFileFor(supabase: Supabase, m: MaterialRow): Promise<GeminiFile> {
  if (m.gemini_uri && m.gemini_expires_at && Date.parse(m.gemini_expires_at) - Date.now() > REUPLOAD_MARGIN_MS) {
    return { uri: m.gemini_uri, mimeType: "application/pdf" };
  }

  const { data: blob, error } = await supabase.storage.from(MATERIALS_BUCKET).download(m.path);
  if (error || !blob) throw new Error(`자료를 불러오지 못했어요: ${error?.message}`);
  const { uri, expiresAt } = await uploadFile(await blob.arrayBuffer(), "application/pdf", m.name);

  await supabase
    .from("materials")
    .update({ gemini_uri: uri, gemini_expires_at: expiresAt })
    .eq("id", m.id);
  return { uri, mimeType: "application/pdf" };
}
