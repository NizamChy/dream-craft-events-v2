import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { ApiError, errorMessage } from "@/lib/api";

/**
 * Maps API validation errors onto react-hook-form fields. Falls back to a
 * toast for errors that don't belong to a known field.
 */
export function handleFormError<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, fields: readonly string[]) {
  if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
    let mapped = false;
    for (const [key, message] of Object.entries(err.fieldErrors)) {
      if (fields.includes(key)) {
        setError(key as Path<T>, { type: "server", message });
        mapped = true;
      }
    }
    if (!mapped) toast.error(errorMessage(err));
    return;
  }
  toast.error(errorMessage(err));
}

/** Converts an ISO date to the value format of <input type="datetime-local">. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
