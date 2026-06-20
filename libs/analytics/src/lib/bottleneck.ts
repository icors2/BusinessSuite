export interface StationMetrics {
  workstationId: string;
  workstationCode: string;
  workstationName: string;
  wip: number;
  avgCycleMinutes: number;
}

export interface BottleneckResult extends StationMetrics {
  isBottleneck: boolean;
  score: number;
}

export function scoreBottlenecks(
  stations: StationMetrics[],
  thresholdMultiplier = 1.5,
): BottleneckResult[] {
  if (stations.length === 0) return [];

  const meanWip =
    stations.reduce((sum, s) => sum + s.wip, 0) / stations.length;
  const threshold = meanWip * thresholdMultiplier;

  return stations
    .map((s) => ({
      ...s,
      isBottleneck: s.wip > threshold && s.wip > 0,
      score: meanWip > 0 ? s.wip / meanWip : s.wip,
    }))
    .sort((a, b) => b.score - a.score);
}
