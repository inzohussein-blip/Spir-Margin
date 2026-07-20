"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveMaintenanceTeam, type MaintenanceTeamInput } from "@/app/actions/maintenance_team";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function MaintenanceTeamForm() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit } = useForm<MaintenanceTeamInput>({
    defaultValues: {
      name: "",
      manager_name: "",
      description: "",
      members: [{ member_name: "", role: "" }],
      tasks: [{ task_name: "", maintenance_type: "preventive", periodicity: "" }],
    },
  });
  const members = useFieldArray({ control, name: "members" });
  const tasks = useFieldArray({ control, name: "tasks" });

  function onSubmit(values: MaintenanceTeamInput) {
    start(async () => {
      const res = await saveMaintenanceTeam(values);
      if (res.ok) router.push("/maintenance-teams");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Team")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Team name")}</span>
            <input {...register("name")} className={cls} placeholder="Field Service Team" />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Manager")}</span>
            <input {...register("manager_name")} className={cls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">{t(locale, "Description")}</span>
            <input {...register("description")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Members")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {members.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <label className="col-span-3 block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Name")}</span>
                <input {...register(`members.${i}.member_name`)} className={cls} />
              </label>
              <label className="col-span-2 block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Role")}</span>
                <input {...register(`members.${i}.role`)} className={cls} placeholder="Technician" />
              </label>
              <div className="flex items-end justify-end">
                <Button type="button" variant="subtle" size="sm" onClick={() => members.remove(i)} disabled={members.fields.length === 1}>
                  <Trash2Icon size={14} />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => members.append({ member_name: "", role: "" })}>
            <PlusIcon size={14} className="mr-1" /> Add member
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Recurring tasks")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {tasks.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <label className="col-span-3 block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Task")}</span>
                <input {...register(`tasks.${i}.task_name`)} className={cls} />
              </label>
              <label className="block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Type")}</span>
                <select {...register(`tasks.${i}.maintenance_type`)} className={cls}>
                  <option value="preventive">preventive</option>
                  <option value="calibration">calibration</option>
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Periodicity")}</span>
                <input {...register(`tasks.${i}.periodicity`)} className={cls} placeholder="Quarterly" />
              </label>
              <div className="flex items-end justify-end">
                <Button type="button" variant="subtle" size="sm" onClick={() => tasks.remove(i)} disabled={tasks.fields.length === 1}>
                  <Trash2Icon size={14} />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => tasks.append({ task_name: "", maintenance_type: "preventive", periodicity: "" })}>
            <PlusIcon size={14} className="mr-1" /> Add task
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        Create team
      </Button>
    </form>
  );
}
