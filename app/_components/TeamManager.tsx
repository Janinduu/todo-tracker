"use client";

import { useState, useTransition } from "react";
import { addMember, renameMember, setMemberActive } from "@/lib/actions";
import type { MemberView } from "@/lib/types";

export function TeamManager({ members }: { members: MemberView[] }) {
  const [error, setError] = useState<string | null>(null);

  const active = members.filter((m) => m.active);
  const inactive = members.filter((m) => !m.active);

  return (
    <div className="space-y-4">
      <AddMemberForm onError={setError} />

      {error && (
        <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
          {error}
        </p>
      )}

      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {active.map((member) => (
          <MemberRow key={member.id} member={member} onError={setError} />
        ))}
        {active.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-faint">
            No active members.
          </p>
        )}
      </div>

      {inactive.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium text-muted">Inactive</h2>
          <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {inactive.map((member) => (
              <MemberRow key={member.id} member={member} onError={setError} />
            ))}
          </div>
          <p className="text-xs text-faint">
            Inactive people stay on their past tasks but disappear from the
            owner picker.
          </p>
        </div>
      )}
    </div>
  );
}

function AddMemberForm({
  onError,
}: {
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onError(null);
    startTransition(async () => {
      const result = await addMember(trimmed);
      if (result.ok) setName("");
      else onError(result.error);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add a team member"
        className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        Add
      </button>
    </form>
  );
}

function MemberRow({
  member,
  onError,
}: {
  member: MemberView;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [pending, startTransition] = useTransition();

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onError(null);
    startTransition(async () => {
      const result = await renameMember(member.id, trimmed);
      if (result.ok) setEditing(false);
      else onError(result.error);
    });
  }

  function toggleActive() {
    onError(null);
    startTransition(async () => {
      const result = await setMemberActive(member.id, !member.active);
      if (!result.ok) onError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {editing ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setName(member.name);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-line px-2 py-1 text-sm outline-none focus:border-accent"
        />
      ) : (
        <span
          className={`min-w-0 flex-1 text-sm ${
            member.active ? "text-ink" : "text-faint"
          }`}
        >
          {member.name}
        </span>
      )}

      <div className="flex shrink-0 gap-1">
        {editing ? (
          <>
            <button
              onClick={save}
              disabled={pending || !name.trim()}
              className="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={() => {
                setName(member.name);
                setEditing(false);
              }}
              className="rounded border border-line px-2.5 py-1 text-xs text-muted"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              disabled={pending}
              className="rounded px-2 py-1 text-xs text-muted hover:bg-canvas hover:text-ink"
            >
              Rename
            </button>
            <button
              onClick={toggleActive}
              disabled={pending}
              className="rounded px-2 py-1 text-xs text-muted hover:bg-canvas hover:text-ink"
            >
              {member.active ? "Deactivate" : "Reactivate"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
