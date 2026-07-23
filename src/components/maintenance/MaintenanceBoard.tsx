"use client";

import { useState, useTransition } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { UserIcon, CalendarIcon, FlaskConicalIcon, GripVerticalIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { setVisitCompletion } from "@/app/actions/maintenance";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

type Completion = "pending" | "partial" | "full";
export interface Visit {
  id: string;
  visit_no: string;
  lab_name: string | null;
  visit_date: string;
  service_person: string | null;
  maintenance_type: string;
  completion_status: Completion;
}

const ORDER: Completion[] = ["pending", "partial", "full"];
const COLUMNS: { key: Completion; titleKey: string; accent: string }[] = [
  { key: "pending", titleKey: "Pending", accent: "border-t-amber-400" },
  { key: "partial", titleKey: "In progress", accent: "border-t-brand" },
  { key: "full", titleKey: "Completed", accent: "border-t-emerald-500" },
];

function Card({ v, overlay = false, onMove }: { v: Visit; overlay?: boolean; onMove?: (id: string, dest: Completion) => void }) {
  const locale = useLocale();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: v.id });
  const idx = ORDER.indexOf(v.completion_status);
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      className={`rounded-lg border border-outline-gray-2 bg-surface-white p-3 shadow-sm ${
        isDragging ? "opacity-40" : ""
      } ${overlay ? "rotate-2 shadow-lg" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-ink-gray-8">{v.visit_no}</span>
        <span
          ref={overlay ? undefined : setNodeRef}
          {...(overlay ? {} : attributes)}
          {...(overlay ? {} : listeners)}
          className={`mt-0.5 shrink-0 text-ink-gray-3 ${overlay ? "" : "cursor-grab active:cursor-grabbing"}`}
          aria-label={t(locale, "Drag")}
        >
          <GripVerticalIcon size={14} />
        </span>
      </div>
      <div className="mt-2 space-y-1 text-xs text-ink-gray-5">
        {v.lab_name && <p className="flex items-center gap-1.5"><FlaskConicalIcon size={12} /> {v.lab_name}</p>}
        <p className="flex items-center gap-1.5"><CalendarIcon size={12} /> {v.visit_date}</p>
        {v.service_person && <p className="flex items-center gap-1.5"><UserIcon size={12} /> {v.service_person}</p>}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-block rounded bg-surface-gray-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-gray-5">
          {t(locale, v.maintenance_type)}
        </span>
        {!overlay && onMove && (
          <div className="flex gap-1">
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => onMove(v.id, ORDER[idx - 1])}
              aria-label={t(locale, "Move back")}
              className="rounded border border-outline-gray-2 p-0.5 text-ink-gray-5 hover:bg-surface-gray-1 disabled:opacity-30"
            >
              <ChevronRightIcon size={14} />
            </button>
            <button
              type="button"
              disabled={idx === ORDER.length - 1}
              onClick={() => onMove(v.id, ORDER[idx + 1])}
              aria-label={t(locale, "Move forward")}
              className="rounded border border-outline-gray-2 p-0.5 text-ink-gray-5 hover:bg-surface-gray-1 disabled:opacity-30"
            >
              <ChevronLeftIcon size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Column({ col, visits, onMove }: { col: (typeof COLUMNS)[number]; visits: Visit[]; onMove: (id: string, dest: Completion) => void }) {
  const locale = useLocale();
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className={`rounded-t-lg border-t-4 bg-surface-gray-1 px-3 py-2 ${col.accent}`}>
        <h2 className="flex items-center justify-between text-sm font-semibold text-ink-gray-8">
          {t(locale, col.titleKey)}
          <span className="rounded-full bg-surface-white px-2 text-xs text-ink-gray-5">{visits.length}</span>
        </h2>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-b-lg border border-t-0 border-outline-gray-1 p-2 transition ${
          isOver ? "bg-brand/5 ring-1 ring-inset ring-brand" : "bg-surface-gray-1/40"
        }`}
      >
        {visits.map((v) => <Card key={v.id} v={v} onMove={onMove} />)}
        {visits.length === 0 && (
          <p className="py-8 text-center text-xs text-ink-gray-4">{t(locale, "Drop cards here")}</p>
        )}
      </div>
    </div>
  );
}

export function MaintenanceBoard({ initial }: { initial: Visit[] }) {
  const [visits, setVisits] = useState<Visit[]>(initial);
  const [active, setActive] = useState<Visit | null>(null);
  const [, startT] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Shared by drag-and-drop and the card move buttons: optimistic update with
  // rollback if the server rejects the change.
  function move(id: string, dest: Completion) {
    const v = visits.find((x) => x.id === id);
    if (!v || v.completion_status === dest) return;
    const prev = v.completion_status;
    setVisits((vs) => vs.map((x) => (x.id === id ? { ...x, completion_status: dest } : x)));
    startT(async () => {
      const res = await setVisitCompletion(id, dest);
      if (!res.ok) setVisits((vs) => vs.map((x) => (x.id === id ? { ...x, completion_status: prev } : x)));
    });
  }

  function onStart(e: DragStartEvent) {
    setActive(visits.find((v) => v.id === e.active.id) ?? null);
  }
  function onEnd(e: DragEndEvent) {
    setActive(null);
    const dest = e.over?.id as Completion | undefined;
    if (dest) move(String(e.active.id), dest);
  }

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd}>
      <div className="flex gap-3">
        {COLUMNS.map((col) => (
          <Column key={col.key} col={col} visits={visits.filter((v) => v.completion_status === col.key)} onMove={move} />
        ))}
      </div>
      <DragOverlay>{active ? <Card v={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
