export type EngineTelemetry = {
  id: number;
  timestamp: string;
  rpm: number;
  egt: number;
  cht: number;
  oil_pressure: number;
  oil_temperature: number;
  vibration: number;
  fuel_flow: number;
  throttle: number;
  fault_mode: string;
};

export type TelemetryResponse = {
  count: number;
  telemetry: EngineTelemetry[];
};

const API_BASE_URL = "http://127.0.0.1:8003";

export async function getEngineHistory(
  limit: number = 50
): Promise<TelemetryResponse> {
  const response = await fetch(
    `${API_BASE_URL}/engine/history?limit=${limit}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch engine history");
  }

  return response.json();
}