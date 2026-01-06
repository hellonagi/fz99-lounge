export const F99_MACHINES = [
  { value: 'Blue Falcon', name: 'Blue Falcon', abbr: 'BF', color: 'text-blue-400' },
  { value: 'Golden Fox', name: 'Golden Fox', abbr: 'GF', color: 'text-yellow-400' },
  { value: 'Wild Goose', name: 'Wild Goose', abbr: 'WG', color: 'text-green-400' },
  { value: 'Fire Stingray', name: 'Fire Stingray', abbr: 'FS', color: 'text-red-400' },
] as const;

export type MachineName = (typeof F99_MACHINES)[number]['value'];

export function getMachineAbbr(machineName: string | null): string {
  if (!machineName) return '-';
  const machine = F99_MACHINES.find((m) => m.value === machineName);
  return machine?.abbr ?? machineName;
}

export function getMachineColor(machineName: string | null): string {
  if (!machineName) return 'text-gray-400';
  const machine = F99_MACHINES.find((m) => m.value === machineName);
  return machine?.color ?? 'text-gray-100';
}
