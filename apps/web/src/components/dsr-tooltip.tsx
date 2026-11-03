export function getDsrTooltipText(attempts: number, dsr: number): string {
  return `Score discounted for ${attempts} total attempts by this builder. DSR: ${(dsr * 100).toFixed(1)}%`;
}
