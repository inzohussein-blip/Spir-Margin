"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface TeamMemberInput { member_name: string; role?: string; }
export interface TeamTaskInput { task_name: string; maintenance_type: "preventive" | "calibration"; periodicity?: string; }
export interface MaintenanceTeamInput {
  name: string;
  manager_name?: string;
  description?: string;
  members: TeamMemberInput[];
  tasks: TeamTaskInput[];
}

/** Create a maintenance team with its members and recurring tasks. */
export async function saveMaintenanceTeam(input: MaintenanceTeamInput) {
  const supabase = createClient();
  if (!input.name?.trim()) return { ok: false as const, error: "Team name is required" };

  const { data: team, error: hErr } = await supabase
    .from("maintenance_teams")
    .insert({
      name: input.name.trim(),
      manager_name: input.manager_name || null,
      description: input.description || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const members = input.members.filter((m) => m.member_name?.trim());
  if (members.length) {
    const { error } = await supabase
      .from("maintenance_team_members")
      .insert(members.map((m) => ({ team_id: team.id, member_name: m.member_name.trim(), role: m.role || null })));
    if (error) return { ok: false as const, error: error.message };
  }

  const tasks = input.tasks.filter((t) => t.task_name?.trim());
  if (tasks.length) {
    const { error } = await supabase.from("maintenance_tasks").insert(
      tasks.map((t) => ({
        team_id: team.id,
        task_name: t.task_name.trim(),
        maintenance_type: t.maintenance_type,
        periodicity: t.periodicity || null,
      }))
    );
    if (error) return { ok: false as const, error: error.message };
  }

  revalidatePath("/maintenance-teams");
  return { ok: true as const, teamId: team.id };
}
