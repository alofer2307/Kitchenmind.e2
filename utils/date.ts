export function toDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chihuahua",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Chihuahua",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Chihuahua",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
