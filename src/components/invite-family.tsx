"use client";

import { useActionState, useState } from "react";
import { createInvite, renameCookbook, revokeInvite, type FormState } from "@/app/actions";
import { ActionForm, Submit } from "@/components/form-bits";
import { ConfirmButton } from "@/components/confirm-button";

/**
 * The family's one join link, for the group chat. On phones "Invite family"
 * opens the share sheet (Messages, WhatsApp…); elsewhere it copies the link.
 * The owner makes the link and can turn it off; other members can pass it on.
 */
export function InviteFamily({
  url,
  expiresOn,
  cookbookName,
  isOwner,
  ownerName,
}: {
  url: string | null;
  /** e.g. "November 2, 2026" */
  expiresOn: string | null;
  cookbookName: string;
  isOwner: boolean;
  ownerName: string | null;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);

  if (!url) {
    if (!isOwner) {
      return (
        <p className="text-[0.95rem] text-ink-soft">
          There&rsquo;s no invite link open right now. Ask {ownerName ?? "whoever started the cookbook"} to make one.
        </p>
      );
    }
    return (
      <form action={createInvite} className="space-y-3">
        <p className="text-[0.95rem] text-ink-soft">
          Make one link for the family group chat. Whoever opens it can join and write in this cookbook.
        </p>
        <Submit pending="Making the link…">Make an invite link</Submit>
      </form>
    );
  }

  const text = `Join ${cookbookName} on Sobremesa`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url!);
      setStatus("Link copied. Paste it in the family chat.");
    } catch {
      setShowLink(true);
      setStatus("Copy the link below.");
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url: url! });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // they closed the share sheet
      }
    }
    await copy();
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={share} data-invite-url={url} className="btn btn-primary w-full">
        Invite family
      </button>
      <button type="button" onClick={copy} className="btn btn-quiet w-full">
        Copy link
      </button>
      {status && <p role="status" className="text-center text-[0.9rem] text-olive italic">{status}</p>}
      {showLink && <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" className="field text-[1rem]" />}
      <p className="text-[0.88rem] text-ink-soft">
        Anyone with this link can join until {expiresOn ?? "it expires"}
        {isOwner ? ", or until you turn it off." : "."}
      </p>
      {isOwner && (
        <form action={revokeInvite}>
          <ConfirmButton label="Turn off this link" confirmLabel="Turn it off" />
        </form>
      )}
    </div>
  );
}

/** The owner names the cookbook; it's what the invite says ("Join … on Sobremesa"). */
export function CookbookName({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await renameCookbook(prev, fd);
    if (result?.ok) setOpen(false);
    return result;
  }, undefined);

  if (!open) {
    return (
      <p className="flex items-baseline justify-between gap-3">
        <span className="font-display text-[1.45rem] leading-tight font-semibold">{name}</span>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 text-[0.88rem] text-burgundy">
          Rename
        </button>
      </p>
    );
  }
  return (
    <ActionForm action={action} pending={pending} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input name="name" defaultValue={name} required maxLength={80} placeholder="The Moreno family cookbook" aria-label="Cookbook name" className="field" />
      {state?.error && <p className="text-[0.9rem] text-burgundy">{state.error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet flex-1">
          Cancel
        </button>
        <div className="flex-[2]">
          <Submit pending="Saving…">Save the name</Submit>
        </div>
      </div>
    </ActionForm>
  );
}
