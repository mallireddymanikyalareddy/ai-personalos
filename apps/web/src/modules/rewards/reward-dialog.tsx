"use client";

import * as React from "react";

import type { Reward } from "@personalos/core";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

import { useOS } from "@/store/use-os";

export function RewardDialog({
  open,
  reward,
  onClose,
}: {
  open: boolean;
  reward: Reward | null;
  onClose: () => void;
}) {
  const os = useOS();
  const { toast } = useToast();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [cost, setCost] = React.useState("100");
  const [icon, setIcon] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setTitle(reward?.title ?? "");
    setDescription(reward?.description ?? "");
    setCost(String(reward?.cost ?? 100));
    setIcon(reward?.icon ?? "");
  }, [open, reward]);

  const save = () => {
    const name = title.trim();
    const points = Math.max(0, Math.round(Number(cost) || 0));
    if (!name) {
      toast("Give the reward a name", { tone: "danger" });
      return;
    }
    if (reward) {
      os.updateReward(reward.id, {
        title: name,
        description: description.trim(),
        cost: points,
        icon: icon.trim() || null,
      });
      toast(`Updated "${name}"`, { tone: "success" });
    } else {
      os.addReward({
        title: name,
        description: description.trim(),
        cost: points,
        icon: icon.trim() || null,
      });
      toast(`Added "${name}" to the store`, { tone: "success" });
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={reward ? "Edit reward" : "Add a reward"}
      description="Create something worth spending your points on."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} data-testid="reward-dialog-save">
            {reward ? "Save changes" : "Add reward"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="reward-title">Name</FieldLabel>
          <Input
            id="reward-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="A long walk, new book, day off…"
            autoFocus
          />
        </div>
        <div>
          <FieldLabel htmlFor="reward-description">Description</FieldLabel>
          <Textarea
            id="reward-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional details"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="reward-cost">Cost (points)</FieldLabel>
            <Input
              id="reward-cost"
              type="number"
              min={0}
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="reward-icon">Icon (optional)</FieldLabel>
            <Input
              id="reward-icon"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              placeholder="e.g. coffee"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
