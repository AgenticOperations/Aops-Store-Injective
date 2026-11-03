export interface SeatBuilderProps {
  initialCapital: number;
  allowedMarkets: string[];
}

export function SeatBuilder({ initialCapital, allowedMarkets }: SeatBuilderProps) {
  return {
    capital: initialCapital,
    markets: allowedMarkets,
  };
}
