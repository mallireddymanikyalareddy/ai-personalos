"use client";

import * as React from "react";

import type { MemberRole } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

import { useAppState, useOS } from "@/store/use-os";

const ROLES: { value: MemberRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "guest", label: "Guest" },
  { value: "owner", label: "Owner" },
];

export function MemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const os = useOS();
  const state = useAppState();
  const { toast } = useToast();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<MemberRole>("member");

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setRole("member");
  }, [open]);

  const canSave = name.trim().length > 0;

  const save = () => {
    const displayName = name.trim();
    if (!displayName) return;
    const normalizedEmail = email.trim().toLowerCase();
    const userId =
      normalizedEmail ||
      `member-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const exists = Object.values(state.members).some(
      (member) => member.userId.toLowerCase() === userId.toLowerCase(),
    );
    if (exists) {
      toast("That person is already a workspace member", { tone: "danger" });
      return;
    }
    os.addMember({ userId, role, displayName });
    toast(`${displayName} added to the workspace`, { tone: "success" });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add workspace member"
      description="Members appear in every project's team panel and can be assigned tasks."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave} data-testid="member-save">
            Add member
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="member-name">Name</FieldLabel>
          <Input
            id="member-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Priya Shah"
            autoFocus
          />
        </div>

        <div>
          <FieldLabel htmlFor="member-email">Email (optional)</FieldLabel>
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="priya@example.com"
          />
          <p className="mt-1 text-[11px] text-ink-3">
            Used as the member ID so assigned work stays linked. Leave blank to generate one.
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="member-role">Role</FieldLabel>
          <select
            id="member-role"
            value={role}
            onChange={(event) => setRole(event.target.value as MemberRole)}
            className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {ROLES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
