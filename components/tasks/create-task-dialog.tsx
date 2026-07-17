"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createTaskAction } from "@/lib/actions/tasks";
import type { ActionState } from "@/lib/actions/team";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_OPTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export interface TaskDomainOption {
  value: string;
  label: string;
  group: string;
}

export function CreateTaskDialog({
  members,
  areaOptions,
  domainOptions,
}: {
  members: Array<{ userId: string; name: string; email?: string }>;
  areaOptions: string[];
  domainOptions: TaskDomainOption[];
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"PERSONAL" | "TEAM">("PERSONAL");
  const [selected, setSelected] = useState<string[]>([]);
  const [primary, setPrimary] = useState("");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTaskAction, null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
      setSelected([]);
      setPrimary("");
    }
  }, [state]);

  const groups = useMemo(() => [...new Set(domainOptions.map((option) => option.group))], [domainOptions]);
  function toggleMember(userId: string, checked: boolean) {
    setSelected((current) => checked ? [...new Set([...current, userId])] : current.filter((id) => id !== userId));
    if (!checked && primary === userId) setPrimary("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Aufgabe anlegen</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aufgabe anlegen</DialogTitle>
          <DialogDescription>Persönliche oder gemeinsame Arbeit mit eindeutiger Verantwortung.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}

          <div className="space-y-2">
            <Label htmlFor="task-title">Titel *</Label>
            <Input id="task-title" name="title" required maxLength={300} placeholder="z. B. Teilwareneingang prüfen" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Beschreibung</Label>
            <textarea id="task-description" name="description" rows={3} maxLength={5000} className="border-input w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Kontext, Ergebnis und wichtige Hinweise" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2 text-sm"><span className="font-medium">Aufgabenart</span>
              <select name="scope" value={scope} onChange={(event) => setScope(event.target.value as "PERSONAL" | "TEAM")} className="border-input h-9 w-full rounded-md border bg-background px-3">
                <option value="PERSONAL">Persönlich</option><option value="TEAM">Teamaufgabe</option>
              </select>
            </label>
            <label className="space-y-2 text-sm"><span className="font-medium">Priorität</span>
              <select name="priority" defaultValue="MEDIUM" className="border-input h-9 w-full rounded-md border bg-background px-3">
                {TASK_PRIORITY_OPTIONS.map((value) => <option key={value} value={value}>{TASK_PRIORITY_LABELS[value]}</option>)}
              </select>
            </label>
            <div className="space-y-2"><Label htmlFor="task-due">Frist</Label><Input id="task-due" name="dueDate" type="date" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="task-area">Bereich</Label><Input id="task-area" name="area" list="task-areas" placeholder="wählen oder frei eingeben" /><datalist id="task-areas">{areaOptions.map((area) => <option key={area} value={area} />)}</datalist></div>
            <label className="space-y-2 text-sm"><span className="font-medium">Fachobjekt</span>
              <select name="domainLink" defaultValue="" className="border-input h-9 w-full rounded-md border bg-background px-3">
                <option value="">Keine Verknüpfung</option>
                {groups.map((group) => <optgroup key={group} label={group}>{domainOptions.filter((option) => option.group === group).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>)}
              </select>
            </label>
          </div>

          <fieldset className="space-y-2 border-y py-3">
            <legend className="text-sm font-medium">Bearbeiter</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {members.map((member) => (
                <label key={member.userId} className="flex items-center gap-2 text-sm">
                  <Checkbox name="assigneeIds" value={member.userId} checked={selected.includes(member.userId)} onCheckedChange={(checked) => toggleMember(member.userId, checked === true)} />
                  <span className="min-w-0"><span className="block truncate">{member.name}</span>{member.email ? <span className="block truncate text-xs text-muted-foreground">{member.email}</span> : null}</span>
                </label>
              ))}
            </div>
            <label className="block space-y-1 text-sm"><span className="font-medium">Primär verantwortlich</span>
              <select name="primaryAssigneeId" value={primary} onChange={(event) => setPrimary(event.target.value)} className="border-input h-9 w-full rounded-md border bg-background px-3">
                <option value="">{scope === "TEAM" ? "Automatisch erster Bearbeiter" : "Automatisch ich"}</option>
                {members.filter((member) => selected.includes(member.userId)).map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
              </select>
            </label>
          </fieldset>

          <div className="space-y-2"><Label htmlFor="task-checklist">Checkliste</Label><textarea id="task-checklist" name="checklist" rows={4} className="border-input w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder={'Ein Punkt pro Zeile\nWare zählen\nZustand dokumentieren'} /><p className="text-xs text-muted-foreground">Der Fortschritt wird daraus automatisch abgeleitet.</p></div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Wird gespeichert…" : "Aufgabe anlegen"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
