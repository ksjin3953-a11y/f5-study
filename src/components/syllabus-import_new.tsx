"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Plus, Upload, X } from "lucide-react";
import { registerMaterial, saveUnitTitles, unitsFromSyllabus } from "@/app/material-actions_new";
import { uploadPdf } from "@/lib/upload-pdf_new";
import { MascotSays } from "@/components/mascot_new";
import { Button } from "@/components/ui-button_new";
import { MaterialIcon } from "@/components/materials_new";
import { MiniKnot } from "@/components/unit-path_new";

// delay: 미리보기에 처음 나타날 때 한 줄씩 톡 떨어지는 순서(ms)
type Row = { key: number; title: string; delay: number };
let nextKey = 0;
const toRows = (titles: string[]) => titles.map((title, i) => ({ key: nextKey++, title, delay: i * 80 }));

// 강의계획서 PDF → AI가 단원 목록 생성 → 미리보기에서 고친 뒤 저장
export function SyllabusImport({ subjectId, existingCount }: { subjectId: string; existingCount: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
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

      setStatus("강의계획서를 읽고 단원을 뽑는 중… 콕콕콕");
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
      // 새 마디가 경로에 그려지면 경로(unit-path_new)가 그쪽으로 스크롤한다.
      setRows(null);
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  // 처리 단계: 올리는 중 → 단원을 뽑는 중
  const stage = !status ? null : status.includes("뽑는") ? "extract" : "upload";
  const filled = rows?.filter((r) => r.title.trim()).length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {rows === null ? (
        stage === "extract" ? (
          <PeckingTree text={status!} />
        ) : stage === "upload" ? (
          <div className="flex h-[140px] flex-col items-center justify-center gap-1 rounded-2xl bg-field px-4" role="status">
            <MaterialIcon paper animate className="h-20 w-28" />
            <span className="text-sm font-bold text-zinc-600">{status}</span>
          </div>
        ) : (
          /* 드롭존: 눌러서 고르거나 PDF를 끌어다 놓는다 */
          <label
            onDragOver={(e) => {
              e.preventDefault();
              if (!pending) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!pending) onFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-center transition-colors ${
              dragging ? "border-brand bg-brand-light" : "border-zinc-300 bg-field hover:bg-zinc-200/60"
            } ${pending ? "pointer-events-none opacity-60" : ""}`}
          >
            <Upload className={`size-7 ${dragging ? "text-brand" : "text-zinc-400"}`} aria-hidden />
            <span className="break-keep text-sm font-bold text-zinc-600">
              강의계획서 PDF를 끌어다 놓거나 눌러서 골라요
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={pending}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        )
      ) : (
        <>
          <MascotSays mood="sunny">
            단원 {rows.length}개를 찾았어! 고칠 거 있으면 고쳐줘
            {existingCount > 0 && (
              <span className="mt-0.5 block text-xs text-zinc-500">지금 있는 단원 {existingCount}개 뒤에 이어서 길을 내요.</span>
            )}
          </MascotSays>
          <ol className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <li key={r.key} className="drop-in flex items-center gap-1.5" style={{ animationDelay: `${r.delay}ms` }}>
                <MiniKnot size={28} />
                <input
                  value={r.title}
                  onChange={(e) => update(r.key, e.target.value)}
                  aria-label={`${i + 1}번 단원명`}
                  className="field h-11 flex-1 px-4 text-base"
                />
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="위로"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30"
                >
                  <ChevronUp className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  aria-label="아래로"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30"
                >
                  <ChevronDown className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => remove(r.key)}
                  aria-label={`${r.title} 빼기`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            onClick={() => setRows((rs) => [...(rs ?? []), ...toRows([""])])}
            variant="neutral"
            size="sm"
            className="w-fit"
          >
            <Plus className="size-4" strokeWidth={3} aria-hidden />
            단원 추가
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => {
                setRows(null);
                setError(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              disabled={pending}
              variant="neutral"
              size="md"
              className="flex-1"
            >
              취소
            </Button>
            <Button type="button" onClick={save} disabled={pending} variant="success" size="md" className="flex-[2]">
              {pending ? "길 내는 중…" : `길 ${filled}칸 내기`}
            </Button>
          </div>
        </>
      )}
      {error && (
        <MascotSays size="sm" mood="rainy">
          {error}
        </MascotSays>
      )}
    </div>
  );
}

// 단원을 뽑는 동안: 딱따구리가 줄기를 쪼고, 1초마다 "콕!"과 함께 빈 마디가 하나씩 생긴다(최대 5개, 대기 연출).
const MAX_KNOTS = 5;
function PeckingTree({ text }: { text: string }) {
  const [knots, setKnots] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setKnots((k) => Math.min(MAX_KNOTS, k + 1)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-[140px] items-center justify-center gap-4 rounded-2xl bg-field px-4" role="status">
      <div className="relative flex items-end">
        <Image src="/mascot_new.png" alt="" width={62} height={92} className="mascot-peck relative z-10" />
        {/* 1초마다 한 번 튀어 오른다(key가 바뀌면 다시 재생) */}
        <span
          key={knots}
          className="peck-pop absolute -right-1 -top-2 z-20 font-display text-lg text-brand"
          style={{ animationIterationCount: 1, animationDuration: "0.8s" }}
        >
          콕!
        </span>
        <div
          className="relative -ml-1 h-[116px] w-7 rounded-full"
          style={{ background: "linear-gradient(90deg, #c08a5e 0%, #b07b50 55%, #9a6a45 100%)" }}
          aria-hidden
        >
          {/* 아래에서 위로 쌓인다 */}
          {Array.from({ length: knots }, (_, i) => (
            <span key={i} className="knot-pop absolute left-1/2 -ml-2.5" style={{ bottom: 4 + i * 22 }}>
              <MiniKnot size={20} />
            </span>
          ))}
        </div>
      </div>
      <p className="max-w-[11rem] break-keep text-sm font-bold text-zinc-600">{text}</p>
    </div>
  );
}
