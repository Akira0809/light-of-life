export type VitalStats = {
  iso3: string;
  births: number;
  deaths: number;
  lat: number;
  lon: number;
};

export type VitalStatsFromSupabase = {
  iso3: string;
  births: number;
  deaths: number;
  countries: { lat: number; lon: number } | null;
};
