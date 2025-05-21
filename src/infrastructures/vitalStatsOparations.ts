import { VitalStats, VitalStatsFromSupabase } from "@/entities/vitalStats";
import { supabase } from "@/lib/supabase";

export const fetchVitalStatsByYearOperation = async (
  year: number
): Promise<Array<VitalStats>> => {
  const { data, error } = await supabase
    .from("vital_stats")
    .select(
      `
          iso3, births, deaths,
          countries:iso3(lat,lon)
        `
    )
    .eq("year", year)
    /* 
    NOTE: 型推論が合わない！？ 
      ×　contries:{lat:number,lon:number}
      ○　countries:Array<{lat:number,lon:number}>
      ではないか説
    */
    .returns<Array<VitalStatsFromSupabase>>();

  if (error) throw error;
  if (!data?.length) return [];

  const vitalStats: Array<VitalStats> = data
    .filter(
      (
        record
      ): record is VitalStatsFromSupabase & {
        countries: { lat: number; lon: number };
      } => record.countries !== null
    )
    .map(
      (record) =>
        ({
          iso3: record.iso3,
          births: record.births,
          deaths: record.deaths,
          lat: record.countries.lat,
          lon: record.countries.lon,
        } as VitalStats)
    );

  return vitalStats;
};
