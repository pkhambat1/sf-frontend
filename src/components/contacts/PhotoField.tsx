"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { AVATAR_MAX_PX, MAX_PHOTO_BYTES, PHOTO_MIME_TYPES } from "@/lib/contacts/schema";

/**
 * Decode an image file and re-encode it as an avatar-sized JPEG data URL.
 *
 * Downscaling here rather than storing the original matters twice over: a phone
 * photo base64-encodes to several MB, which both bloats the in-memory store and
 * overruns the 1 MB body limit Next.js puts on Server Actions — the request
 * would 413 before the form's own validation ever ran.
 */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, AVATAR_MAX_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");

    // PNG and WebP can carry alpha and JPEG cannot, so a transparent image would
    // encode its clear pixels as black. Composite onto white first — the avatar
    // then reads the same as it would on any light surface.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

/**
 * Circular photo picker for the contact form. The selected image is held in a
 * hidden `photo` input as a base64 data URL, so it rides through the same server
 * action as every other field — including on edit, where the value defaults to
 * the contact's current photo so a save never wipes it.
 */
export default function PhotoField({
  defaultPhoto,
  error,
  onBusyChange,
}: {
  defaultPhoto?: string | null;
  error?: string;
  /** Lets the form block a submit while an image is still being processed. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  // Bumped on every pick and on removal, so a slow decode that finishes after a
  // newer pick — or after the photo was removed — is discarded instead of applied.
  const pickSeq = useRef(0);
  const [photo, setPhoto] = useState<string | null>(defaultPhoto ?? null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setBusyState(next: boolean) {
    setBusy(next);
    onBusyChange?.(next);
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!PHOTO_MIME_TYPES.includes(file.type as (typeof PHOTO_MIME_TYPES)[number])) {
      setLocalError("Choose a PNG, JPEG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setLocalError("That image is over 10 MB — pick a smaller one.");
      return;
    }

    const seq = ++pickSeq.current;
    setLocalError(null);
    setBusyState(true);

    try {
      const dataUrl = await toAvatarDataUrl(file);
      if (seq !== pickSeq.current) return; // superseded by a later pick or a removal
      setPhoto(dataUrl);
    } catch {
      if (seq !== pickSeq.current) return;
      setLocalError("That image could not be read. Try another file.");
    } finally {
      if (seq === pickSeq.current) setBusyState(false);
    }
  }

  function onRemove() {
    pickSeq.current += 1; // invalidate any decode still in flight
    setPhoto(null);
    setLocalError(null);
    setBusyState(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const message = localError ?? error;

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name="photo" value={photo ?? ""} />

      {busy ? (
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"
        >
          <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.5} />
        </span>
      ) : photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- base64 data URL, no loader needed
        <img
          src={photo}
          alt="Contact photo preview"
          className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-hairline"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/60"
        >
          <ImagePlus className="h-6 w-6" strokeWidth={1.5} />
        </span>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label
            htmlFor={inputId}
            aria-disabled={busy}
            className={`${buttonClasses("secondary")} ${busy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
          >
            {busy ? "Processing…" : photo ? "Change photo" : "Upload photo"}
          </label>
          {photo && !busy ? (
            <button type="button" onClick={onRemove} className={buttonClasses("ghost")}>
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Remove
            </button>
          ) : null}
        </div>
        <p className={message ? "text-[13px] text-destructive" : "text-[13px] text-muted-foreground"}>
          {message ??
            "PNG, JPEG, GIF, or WebP. Large photos are scaled down to avatar size."}
        </p>
      </div>

      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept={PHOTO_MIME_TYPES.join(",")}
        onChange={onPick}
        className="sr-only"
      />
    </div>
  );
}
