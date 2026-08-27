import { z } from "zod";
import { ADDRESS_TYPES, type AddressInput, type ContactInput, type ContactTextField } from "./types";

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

/**
 * A profile photo arrives as a base64 data URL. These bounds mirror the API's
 * Pydantic rules so a bad image is caught before the round trip.
 */
export const PHOTO_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
/** Longest edge of the stored avatar; larger images are scaled down to fit. */
export const AVATAR_MAX_PX = 512;
/** Upper bound on the file a user may pick, before it is scaled down. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PHOTO_LENGTH = 2_800_000; // ~2 MB once base64-encoded
const PHOTO_DATA_URL = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]+$/;

const photoField = z
  .string()
  .trim()
  .transform((value) => value || null)
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || value.length <= MAX_PHOTO_LENGTH,
    "Image is too large — use one under 2 MB",
  )
  .refine(
    (value) => value === null || PHOTO_DATA_URL.test(value),
    "Photo must be a PNG, JPEG, GIF, or WebP image",
  );
/** One address row. Mirrors the API's `AddressCreate`. */
export const addressInputSchema = z.object({
  type: z.enum(ADDRESS_TYPES),
  street: optionalText(300, "Street address"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(120, "Country"),
}) satisfies z.ZodType<AddressInput, unknown>;

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  addresses: z.array(addressInputSchema).default([]),
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
  photo: photoField,
}) satisfies z.ZodType<ContactInput, unknown>;

export type ContactFormValues = z.input<typeof contactInputSchema>;

/** Collapse a ZodError into one message per field, keyed by input name. */
export function zodFieldErrors(
  error: z.ZodError,
): Partial<Record<ContactTextField, string>> {
  const fieldErrors: Partial<Record<ContactTextField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && key !== "addresses" && !(key in fieldErrors)) {
      fieldErrors[key as ContactTextField] = issue.message;
    }
  }
  return fieldErrors;
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

export interface ContactFieldSpec {
  name: ContactTextField;
  label: string;
  type?: "text" | "email" | "tel" | "textarea";
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

export interface ContactFieldGroup {
  title: string;
  description: string;
  fields: ContactFieldSpec[];
}

export const CONTACT_FIELD_GROUPS: ContactFieldGroup[] = [
  {
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
    ],
  },
  {
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/** Pull the plain text contact fields out of a submitted form, as raw strings. */
export function formDataToValues(
  formData: FormData,
): Record<ContactTextField, string> {
  const values = Object.fromEntries(
    CONTACT_FIELDS.map((field) => [
      field.name,
      String(formData.get(field.name) ?? ""),
    ]),
  ) as Record<ContactTextField, string>;
  // `photo` is carried by a dedicated picker, not a text Field, but it still
  // rides along in the form data — including on edit, so a PUT never wipes it.
  values.photo = String(formData.get("photo") ?? "");
  return values;
}

/** The address inputs are repeated once per row, so each part arrives as a list. */
const ADDRESS_PARTS = ["id", "type", "street", "city", "state", "postal_code", "country"] as const;
const ADDRESS_TEXT_PARTS = ["street", "city", "state", "postal_code", "country"] as const;

/**
 * Rebuild the address rows from a submitted form.
 *
 * Each row renders one input per part under the same name, so `getAll` returns
 * them in document order and index `i` of every list belongs to row `i`.
 *
 * A row is dropped only when it is *new* and entirely blank — the case where the
 * user clicked "Add address" and then ignored it. A row carrying an id is an
 * address the API already stores, so it is kept even when every postal field is
 * empty; saving is a full-replacement PUT, and dropping it here would delete it.
 */
export function formDataToAddresses(formData: FormData): AddressInput[] {
  const columns = Object.fromEntries(
    ADDRESS_PARTS.map((part) => [part, formData.getAll(`address_${part}`).map(String)]),
  ) as Record<(typeof ADDRESS_PARTS)[number], string[]>;

  return columns.type
    .map((_, row) =>
      Object.fromEntries(ADDRESS_PARTS.map((part) => [part, columns[part][row] ?? ""])),
    )
    .filter(
      (row) =>
        row.id?.trim() || ADDRESS_TEXT_PARTS.some((part) => row[part]?.trim()),
    )
    .map((row) => ({
      type: (ADDRESS_TYPES as readonly string[]).includes(row.type)
        ? (row.type as AddressInput["type"])
        : "Home",
      street: row.street?.trim() || null,
      city: row.city?.trim() || null,
      state: row.state?.trim() || null,
      postal_code: row.postal_code?.trim() || null,
      country: row.country?.trim() || null,
    }));
}
