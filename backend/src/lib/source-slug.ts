import { v7 as uuidv7 } from "uuid";

export function createSourceSlug(url: string, title?: string): string {
  const preferredBase = normalizeOptionalString(title) ?? new URL(url).hostname;
  const normalizedBase = preferredBase
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 96);
  const suffix = uuidv7().slice(-12);

  return `${normalizedBase || "source"}-${suffix}`;
}

export function normalizeOptionalSlug(
  value: string | undefined,
): string | undefined {
  const trimmedValue = value?.trim();

  if (trimmedValue === undefined || trimmedValue === "") {
    return undefined;
  }

  const normalizedValue = trimmedValue
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 128);

  return normalizedValue === "" ? undefined : normalizedValue;
}

function normalizeOptionalString(
  value: string | undefined,
): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue === "" ? undefined : trimmedValue;
}
