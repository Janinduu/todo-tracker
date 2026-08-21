"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { addTask, deleteTask, setTaskStatus, updateTask } from "@/lib/actions";
import type { MemberView, TaskView } from "@/lib/types";
import { OwnerPicker } from "./OwnerPicker";

export function TaskList({
  periodId,
  tasks,
  members,
  readOnlyNotice,
}: {
  periodId: string;
  tasks: TaskView[];
  members: MemberView[];
  readOnlyNotice?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Ticking a box is the single most-used interaction in a live meeting, so it
  // flips instantly and reconciles when the server action returns.
  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (current: TaskView[], update: { id: string; status: "open" | "done" }) =>
      current.map((t) =>
        t.id === update.id ? { ...t, status: update.status } : t,
      ),
  );

  const openTasks = optimisticTasks.filter((t) => t.status === "open");
  const doneTasks = optimisticTasks.filter((t) => t.status === "done");

  function toggle(task: TaskView) {
    const next = task.status === "done" ? "open" : "done";
    setError(null);
    startTransition(async () => {
      applyOptimistic({ id: task.id, status: next });
      const result = await setTaskStatus(task.id, next === "done");
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {readOnlyNotice && (
        <p className="text-xs text-muted">{readOnlyNotice}</p>
      )}

      <AddTaskForm
        periodId={periodId}
        members={members.filter((m) => m.active)}
        onError={setError}
      />

      {error && (
        <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
          {error}
        </p>
      )}

      {optimisticTasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
          No tasks yet.
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {[...openTasks, ...doneTasks].map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              members={members}
              onToggle={() => toggle(task)}
              onError={setError}
            />
          ))}
        </div>
      )}

      {optimisticTasks.length > 0 && (
        <p className="text-xs text-faint">
          {openTasks.length} open · {doneTasks.length} done
        </p>
      )}
    </div>
  );
}

function AddTaskForm({
  periodId,
  members,
  onError,
}: {
  periodId: string;
  members: MemberView[];
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [owners, setOwners] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Clear immediately so the next item can be typed without waiting.
    setText("");
    setOwners([]);
    onError(null);
    inputRef.current?.focus();

    startTransition(async () => {
      const result = await addTask(periodId, trimmed, owners);
      if (!result.ok) {
        onError(result.error);
        setText(trimmed);
      }
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task"
          className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
        >
          Add
        </button>
      </form>
      <div className="mt-2">
        <OwnerPicker
          members={members}
          selected={owners}
          onToggle={(id) =>
            setOwners((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
        />
      </div>
    </div>
  );
}

function TaskRow({
  task,
  members,
  onToggle,
  onError,
}: {
  task: TaskView;
  members: MemberView[];
  onToggle: () => void;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(task.text);
  const [owners, setOwners] = useState(task.owners.map((o) => o.id));
  const [pending, startTransition] = useTransition();

  const done = task.status === "done";

  function save() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onError(null);
    startTransition(async () => {
      const result = await updateTask(task.id, trimmed, owners);
      if (!result.ok) onError(result.error);
      else setEditing(false);
    });
  }

  function cancel() {
    setText(task.text);
    setOwners(task.owners.map((o) => o.id));
    setEditing(false);
  }

  function remove() {
    onError(null);
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (!result.ok) onError(result.error);
    });
  }

  if (editing) {
    return (
      <div className="space-y-2 bg-canvas/60 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {/* Inactive members stay selectable here so an existing assignment can
            be kept while editing a task's text. */}
        <OwnerPicker
          members={members.filter(
            (m) => m.active || owners.includes(m.id),
          )}
          selected={owners}
          onToggle={(id) =>
            setOwners((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={pending || !text.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={cancel}
            disabled={pending}
            className="rounded-md border border-line px-3 py-1.5 text-xs text-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5">
      <input
        type="checkbox"
        checked={done}
        onChange={onToggle}
        aria-label={done ? `Reopen ${task.text}` : `Complete ${task.text}`}
        className="mt-1 size-4 shrink-0 cursor-pointer"
      />

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm break-words ${
            done ? "text-faint line-through" : "text-ink"
          }`}
        >
          {task.text}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {task.owners.length === 0 ? (
            <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] text-muted">
              Team
            </span>
          ) : (
            task.owners.map((owner) => (
              <span
                key={owner.id}
                className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent"
              >
                {owner.name}
              </span>
            ))
          )}
          {task.carriedCount > 0 && (
            <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[11px] text-warn">
              carried {task.carriedCount}x
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          onClick={() => setEditing(true)}
          disabled={pending}
          aria-label="Edit task"
          className="rounded px-1.5 py-1 text-xs text-muted hover:bg-canvas hover:text-ink"
        >
          Edit
        </button>
        <button
          onClick={remove}
          disabled={pending}
          aria-label="Delete task"
          className="rounded px-1.5 py-1 text-xs text-muted hover:bg-warn-soft hover:text-warn"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
