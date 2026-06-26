export function getLevelName(level: number): string {
  if (level <= 1) return "Newcomer";
  if (level <= 2) return "Active Citizen";
  if (level <= 3) return "Community Leader";
  if (level <= 4) return "Civic Hero";
  return "City Guardian";
}
