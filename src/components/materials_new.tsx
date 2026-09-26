"use client";

import { useRef, useState, useTransition } from "react";
import { deleteMaterial, registerMaterial, setMaterialUnit } from "@/app/material-actions_new";
import { MAX_PDF_MB, uploadPdf } from "@/lib/upload-pdf_new";

type Material = { id: string; name: string; size: number; unit_id: string | null };
type Unit = { id: string; title: string };

const ALL = ""; // 단원 선택: 과목 전체

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`;
}

// 강의자료 PDF 올리기. 단원을 고르면 그 단원 퀴즈에, 과목 전체로 두면 자료가 없는 단원 퀴즈에 쓰인다.
export function Materials({
  subjectId,
  units,
  materials,
  ready,
}: {
  subjectId: string;
  units: Unit[];
  materials: Material[];
  ready: boolean; // materials 테이블이 있는지
}) {
  const [unitId, setUnitId] = useState(ALL);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files];
    setErrors([]);
    startTransition(async () => {
      const failed: string[] = [];
      for (const [i, file] of list.entries()) {
        setStatus(`올리는 중… (${i + 1}/${list.length}) ${file.name}`);
        const up = await uploadPdf(file, subjectId);
        if ("error" in up) {
          failed.push(up.error);
          continue;
        }
        const reg = await registerMaterial({
          subjectId,
          unitId: unitId || null,
          kind: "lecture",
          name: file.name,
          path: up.path,
          size: file.size,
        });
        if ("error" in reg) failed.push(`${file.name}: ${reg.error}`);
      }
      setErrors(failed);
      setStatus(null);
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">📚 강의자료</h2>
        <p className="text-sm text-zinc-600">
          PDF를 올리면 AI 퀴즈가 수업 내용으로 출제돼요. 단원을 고르면 그 단원 퀴즈에만 쓰여요.
        </p>
      </div>

      {!ready ? (
        <p className="text-sm text-zinc-500">
          강의자료를 쓰려면 DB에 materials 테이블과 보관함을 만들어 주세요. (supabase/schema_new.sql)
        </p>
      ) : (
        <>
          {materials.length > 0 && (
            <ul className="flex flex-col gap-2">
              {materials.map((m) => (
                <li key={m.id} className="flex flex-col gap-1.5 rounded-xl bg-white px-3 py-2 ring-1 ring-emerald-100">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-all text-sm font-medium">
                      📄 {m.name} <span className="text-xs font-normal text-zinc-400">{sizeLabel(m.size)}</span>
                    </span>
                    <button
                      onClick={() => startTransition(() => deleteMaterial(m.id))}
                      disabled={pending}
                      className="shrink-0 text-sm text-zinc-400 hover:text-red-600"
                      aria-label={`${m.name} 삭제`}
                    >
                      삭제
                    </button>
                  </div>
                  <select
                    value={m.unit_id ?? ALL}
                    onChange={(e) => startTransition(() => setMaterialUnit(m.id, e.target.value || null))}
                    disabled={pending}
                    aria-label={`${m.name} 단원`}
                    className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-700"
                  >
                    <option value={ALL}>과목 전체</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.title}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2">
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={pending}
              aria-label="올릴 자료의 단원"
              className="h-10 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
            >
              <option value={ALL}>단원: 과목 전체</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  단원: {u.title}
                </option>
              ))}
            </select>
            <label
              className={`flex h-11 cursor-pointer items-center justify-center rounded-full bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-500 ${
                pending ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {status ?? "강의자료 PDF 올리기 (여러 개 가능)"}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="sr-only"
                disabled={pending}
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
            <p className="text-xs text-zinc-400">파일당 {MAX_PDF_MB}MB까지 · 퀴즈 한 번에 최근 자료 3개까지 읽어요</p>
          </div>
        </>
      )}
      {errors.map((e) => (
        <p key={e} className="text-sm text-red-600">
          {e}
        </p>
      ))}
    </section>
  );
}
