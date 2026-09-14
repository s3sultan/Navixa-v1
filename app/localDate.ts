const pad2 = (value: number) => String(value).padStart(2, "0");

export function localDateKey(offsetDays = 0, base = new Date()) {
  const date = new Date(base);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
