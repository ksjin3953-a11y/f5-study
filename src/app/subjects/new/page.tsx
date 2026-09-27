import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server_new";
import { SubjectWizard } from "@/components/subject-wizard_new";

// 과목 추가: 앱 셸 없이 화면 전체를 쓰는 집중 모드
export default async function NewSubjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return <SubjectWizard />;
}
