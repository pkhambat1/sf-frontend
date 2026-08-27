"use client";

import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import Button, { buttonClasses } from "@/components/ui/Button";
import { ADDRESS_TYPES, type AddressInput } from "@/lib/contacts/types";

const CONTROL =
  "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary focus:bg-input";

const EMPTY: AddressInput = {
  type: "Home",
  street: null,
  city: null,
  state: null,
  postal_code: null,
  country: null,
};

/** Rows carry a key so React keeps inputs stable as rows are added and removed. */
interface Row extends AddressInput {
  key: number;
}

function toRows(addresses: AddressInput[]): Row[] {
  return addresses.map((address, index) => ({ ...address, key: index }));
}

/**
 * The contact's addresses, edited as a list.
 *
 * Every row renders its inputs under the same repeated names, so the server
 * action can zip them back into rows by index — no client-side JSON blob, and
 * the list still submits without JavaScript.
 */
export default function AddressFields({
  defaultAddresses = [],
}: {
  defaultAddresses?: AddressInput[];
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(defaultAddresses));
  const [nextKey, setNextKey] = useState(defaultAddresses.length);

  function addRow() {
    setRows((current) => [...current, { ...EMPTY, key: nextKey }]);
    setNextKey((key) => key + 1);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <MapPin className="h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-[13px] text-muted-foreground">
            No addresses yet. A contact can have as many as you need.
          </p>
        </div>
      ) : null}

      {rows.map((row, index) => (
        <fieldset key={row.key} className="rounded-lg border border-border bg-card/40 p-4">
          <legend className="sr-only">Address {index + 1}</legend>

          <div className="mb-3 flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <span className="sr-only">Address {index + 1} type</span>
              <select name="address_type" defaultValue={row.type} className={`${CONTROL} w-auto`}>
                {ADDRESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => removeRow(row.key)}
              aria-label={`Remove address ${index + 1}`}
              className={buttonClasses("ghost", "sm")}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Remove
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="address_street"
              defaultValue={row.street ?? ""}
              maxLength={300}
              placeholder="1 Market St, Suite 400"
              autoComplete="street-address"
              aria-label={`Address ${index + 1} street`}
              className={`${CONTROL} sm:col-span-2`}
            />
            <input
              name="address_city"
              defaultValue={row.city ?? ""}
              maxLength={120}
              placeholder="San Francisco"
              aria-label={`Address ${index + 1} city`}
              className={CONTROL}
            />
            <input
              name="address_state"
              defaultValue={row.state ?? ""}
              maxLength={120}
              placeholder="CA"
              aria-label={`Address ${index + 1} state or region`}
              className={CONTROL}
            />
            <input
              name="address_postal_code"
              defaultValue={row.postal_code ?? ""}
              maxLength={20}
              placeholder="94105"
              aria-label={`Address ${index + 1} postal code`}
              className={CONTROL}
            />
            <input
              name="address_country"
              defaultValue={row.country ?? ""}
              maxLength={120}
              placeholder="USA"
              aria-label={`Address ${index + 1} country`}
              className={CONTROL}
            />
          </div>
        </fieldset>
      ))}

      <Button type="button" variant="secondary" onClick={addRow}>
        <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Add address
      </Button>
    </div>
  );
}
