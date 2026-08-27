import {
  CONTACT_FIELDS,
  contactInputSchema,
  formDataToAddresses,
  formDataToValues,
  zodFieldErrors,
} from "@/lib/contacts/schema";

function values(overrides: Record<string, string> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    notes: "",
    photo: "",
    ...overrides,
  };
}

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).email).toBe("Enter a valid email address");
  });

  it("keeps a valid photo data URL and nulls a blank one", () => {
    expect(contactInputSchema.parse(values({ photo: PHOTO })).photo).toBe(PHOTO);
    expect(contactInputSchema.parse(values()).photo).toBeNull();
  });

  it("rejects a photo that is not an image data URL", () => {
    const result = contactInputSchema.safeParse(
      values({ photo: "https://example.com/avatar.png" }),
    );

    expect(zodFieldErrors(result.error!).photo).toBe(
      "Photo must be a PNG, JPEG, GIF, or WebP image",
    );
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101), company: "c".repeat(201) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      company: "Company must be 200 characters or fewer",
    });
  });

  it("defaults to no addresses and accepts a list of them", () => {
    expect(contactInputSchema.parse(values()).addresses).toEqual([]);

    const parsed = contactInputSchema.parse({
      ...values(),
      addresses: [
        { type: "Work", street: "1 Market St", city: "San Francisco", state: "CA", postal_code: "94105", country: "USA" },
        { type: "Home", street: "", city: "London", state: "", postal_code: "", country: "UK" },
      ],
    });

    expect(parsed.addresses).toHaveLength(2);
    expect(parsed.addresses[0].type).toBe("Work");
    // Blank parts become null, matching how the API clears a field.
    expect(parsed.addresses[1].street).toBeNull();
  });

  it("rejects an address type the API does not accept", () => {
    const result = contactInputSchema.safeParse({
      ...values(),
      addresses: [{ type: "Vacation", street: "", city: "Nice", state: "", postal_code: "", country: "FR" }],
    });

    expect(result.success).toBe(false);
  });
});

describe("formDataToAddresses", () => {
  function rowsInto(formData: FormData, rows: Record<string, string>[]) {
    for (const row of rows) {
      for (const part of ["id", "type", "street", "city", "state", "postal_code", "country"]) {
        formData.append(`address_${part}`, row[part] ?? "");
      }
    }
    return formData;
  }

  it("zips the repeated inputs back into rows, in order", () => {
    const formData = rowsInto(new FormData(), [
      { type: "Work", street: "1 Market St", city: "San Francisco" },
      { type: "Home", city: "London", country: "UK" },
    ]);

    expect(formDataToAddresses(formData)).toEqual([
      { type: "Work", street: "1 Market St", city: "San Francisco", state: null, postal_code: null, country: null },
      { type: "Home", street: null, city: "London", state: null, postal_code: null, country: "UK" },
    ]);
  });

  it("keeps two rows that share a type", () => {
    const formData = rowsInto(new FormData(), [
      { type: "Work", city: "San Francisco" },
      { type: "Work", city: "New York" },
    ]);

    expect(formDataToAddresses(formData).map((a) => a.city)).toEqual([
      "San Francisco",
      "New York",
    ]);
  });

  it("drops a new row the user added but never filled in", () => {
    const formData = rowsInto(new FormData(), [
      { type: "Work", city: "San Francisco" },
      { type: "Home" },
    ]);

    expect(formDataToAddresses(formData)).toHaveLength(1);
  });

  it("keeps a stored address even when every field is blank", () => {
    // Saving is a full-replacement PUT, so dropping this row would delete it.
    const formData = rowsInto(new FormData(), [
      { type: "Work", city: "San Francisco" },
      { type: "Home", id: "7" },
    ]);

    expect(formDataToAddresses(formData).map((a) => a.type)).toEqual([
      "Work",
      "Home",
    ]);
  });

  it("returns nothing when the form has no address rows", () => {
    expect(formDataToAddresses(new FormData())).toEqual([]);
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    // `photo` rides along in the form data even though it is not a text Field.
    expect(Object.keys(extracted).sort()).toEqual(
      [...CONTACT_FIELDS.map((field) => field.name), "photo"].sort(),
    );
  });
});
