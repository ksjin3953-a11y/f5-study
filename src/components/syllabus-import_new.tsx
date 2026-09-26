"use client";

import { useRef, useState, useTransition } from "react";
import { registerMaterial, saveUnitTitles, unitsFromSyllabus } from "@/app/material-actions_new";
import { uploadPdf } from "@/lib/upload-pdf_new";
import { MascotSays } from "@/components/mascot_new";

type Row = { key: number; title: string };
let nextKey = 0;
const toRows = (titles: string[]) => titles.map((title) => ({ key: nextKey++, title }));

// 강의계획서 PDF → AI가 단원 목록 생성 → 미리보기에서 고친 뒤 저장
export function SyllabusImport({ subjectId, existingCount }: { subjectId: string; existingCount: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      setStatus("강의계획서를 올리는 중…");
      const up = await uploadPdf(file, subjectId);
      if ("error" in up) return fail(up.error);

      const reg = await registerMaterial({
        subjectId,
        unitId: null,
        kind: "syllabus",
        name: file.name,
        path: up.path,
        size: file.size,
      });
      if ("error" in reg) return fail(reg.error);

      setStatus("강의계획서를 읽고 단원을 뽑는 중… 콕콕콕 🪵");
      const res = await unitsFromSyllabus(reg.id);
      if ("error" in res) return fail(res.error);
      setRows(toRows(res.units));
      setStatus(null);
    });
  };

  const fail = (message: string) => {
    setError(message);
    setStatus(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const update = (key: number, title: string) =>
    setRows((rs) => rs && rs.map((r) => (r.key === key ? { ...r, title } : r)));
  const remove = (key: number) => setRows((rs) => rs && rs.filter((r) => r.key !== key));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      if (!rs || i + d < 0 || i + d >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  const save = () => {
    const titles = (rows ?? []).map((r) => r.title.trim()).filter(Boolean);
    if (titles.length === 0) return setError("저장할 단원이 없어요.");
    setError(null);
    startTransition(async () => {
      const res = await saveUnitTitles(subjectId, titles);
      if (res.error) return setError(res.error);
      setRows(null);
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">📄 강의계획서로 단원 만들기</h2>
        <p className="text-sm text-zinc-600">PDF를 올리면 AI가 주차별 내용을 읽고 단원 목록을 만들어요.</p>
      </div>

      {rows === null ? (
        <>
          <label
            className={`flex h-11 cursor-pointer items-center justify-center rounded-full bg-violet-600 text-sm font-medium text-white transition-colors hover:bg-violet-500 ${
              pending ? "pointer-events-none opacity-50" : ""
            }`}
          >
            강의계획서 PDF 고르기
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={pending}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {status && <MascotSays size="sm">{status}</MascotSays>}
        </>
      ) : (
        <>
          <p className="text-sm text-zinc-600">
            단원 {rows.length}개를 찾았어요. 고치거나 지운 뒤 저장하세요.
            {existingCount > 0 && ` 지금 있는 단원 ${existingCount}개 뒤에 추가돼요.`}
          </p>
          <ol className="flex flex-col gap-1.5">
            {rows.map((r, i) => (
              <li key={r.key} className="flex items-center gap-1">
                <span className="w-6 shrink-0 text-right text-xs text-zinc-400">{i + 1}</span>
                <input
                  value={r.title}
                  onChange={(e) => update(r.key, e.target.value)}
                  aria-label={`${i + 1}번 단원명`}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
                />
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="위로"
                  className="h-9 w-7 shrink-0 text-zinc-400 hover:text-zinc-900 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  aria-label="아래로"
                  className="h-9 w-7 shrink-0 text-zinc-400 hover:text-zinc-900 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => remove(r.key)}
                  aria-label={`${r.title} 빼기`}
                  className="h-9 w-7 shrink-0 text-zinc-400 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          <button
            onClick={() => setRows((rs) => [...(rs ?? []), ...toRows([""])])}
            className="h-9 rounded-full border border-dashed border-zinc-400 text-sm text-zinc-600 hover:bg-white"
          >
            + 단원 추가
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRows(null);
                setError(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              disabled={pending}
              className="h-10 flex-1 rounded-full border border-zinc-300 text-sm text-zinc-700 hover:bg-white"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={pending}
              className="h-10 flex-[2] rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {pending ? "저장 중…" : `단원 ${rows.filter((r) => r.title.trim()).length}개 저장`}
            </button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
