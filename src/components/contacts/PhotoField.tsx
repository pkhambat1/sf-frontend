"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { MAX_PHOTO_BYTES, PHOTO_MIME_TYPES } from "@/lib/contacts/schema";

/** Read a file into a base64 data URL. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
}: {
  defaultPhoto?: string | null;
  error?: string;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(defaultPhoto ?? null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!PHOTO_MIME_TYPES.includes(file.type as (typeof PHOTO_MIME_TYPES)[number])) {
      setLocalError("Choose a PNG, JPEG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setLocalError("That image is over 2 MB — pick a smaller one.");
      return;
    }

    setLocalError(null);
    setPhoto(await readAsDataUrl(file));
  }

  function onRemove() {
    setPhoto(null);
    setLocalError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const message = localError ?? error;

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name="photo" value={photo ?? ""} />

      {photo ? (
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
          <label htmlFor={inputId} className={`${buttonClasses("secondary")} cursor-pointer`}>
            {photo ? "Change photo" : "Upload photo"}
          </label>
          {photo ? (
            <button type="button" onClick={onRemove} className={buttonClasses("ghost")}>
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Remove
            </button>
          ) : null}
        </div>
        <p className={message ? "text-[13px] text-destructive" : "text-[13px] text-muted-foreground"}>
          {message ?? "PNG, JPEG, GIF, or WebP · up to 2 MB. Falls back to initials."}
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
