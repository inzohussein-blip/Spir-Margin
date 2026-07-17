"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRef } from "react";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { uploadAttachmentAction } from "@/app/actions/attachments";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
      {pending ? <Loader2Icon size={14} className="animate-spin" /> : <UploadIcon size={14} />}
      Upload
    </button>
  );
}

export function AttachmentUpload({ entity, recordId, path }: { entity: string; recordId: string; path: string }) {
  const [state, formAction] = useFormState(uploadAttachmentAction, null as { error?: string; ok?: boolean; message?: string } | null);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form ref={ref} action={async (fd) => { await formAction(fd); ref.current?.reset(); }} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="path" value={path} />
      <input name="file" type="file" required className="text-sm text-ink-gray-6 file:mr-2 file:rounded-md file:border file:border-outline-gray-2 file:bg-surface-gray-1 file:px-2 file:py-1 file:text-xs" />
      <SubmitButton />
      {state?.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
      {state?.ok ? <span className="text-xs text-emerald-700">{state.message}</span> : null}
    </form>
  );
}
