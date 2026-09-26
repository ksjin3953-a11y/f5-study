// 브라우저에서 PDF를 Supabase Storage(materials 버킷)에 바로 올린다.
// 서버를 거치지 않아서 Vercel 요청 크기 제한(4.5MB)에 걸리지 않는다.
import { createClient } from "@/lib/supabase/client_new";

export const MAX_PDF_MB = 50;

export async function uploadPdf(file: File, subjectId: string): Promise<{ path: string } | { error: string }> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: `${file.name}: PDF 파일만 올릴 수 있어요.` };
  }
  if (file.size > MAX_PDF_MB * 1024 * 1024) {
    return { error: `${file.name}: ${MAX_PDF_MB}MB 이하 파일만 올릴 수 있어요.` };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  // 파일 이름은 한글·공백이 섞일 수 있어 경로에는 무작위 이름을 쓰고, 원래 이름은 DB에 둔다.
  const path = `${user.id}/${subjectId}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage
    .from("materials")
    .upload(path, file, { contentType: "application/pdf" });
  if (error) {
    console.error("uploadPdf failed:", error);
    return { error: `${file.name}: 올리지 못했어요. (${error.message})` };
  }
  return { path };
}
