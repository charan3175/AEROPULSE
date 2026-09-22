"use client";

import { useEffect, useState } from "react";

type SensorData = {
  rpm: number;
  egt: number;
  cht: number;
  oil_pressure: number;
  oil_temperature: number;
  vibration: number;
  fuel_flow: number;
  throttle: number;
};

export default function SensorOverview() {
  const [data, setData] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSensorData = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8002/engine/status?fault=normal"
      );

      const result = await response.json();

      setData(result.engine_data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch engine data:", error);
    }
  };

  useEffect(() => {
    const initialFetch = setTimeout(fetchSensorData, 0);

    const interval = setInterval(
      fetchSensorData,
      1000
    );

    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="sensor-panel">
        <h2>Sensor Overview</h2>
        <p>Connecting to engine telemetry...</p>
      </div>
    );
  }

  const sensors = [
    {
      name: "RPM",
      value: data.rpm,
      unit: "RPM",
    },
    {
      name: "EGT",
      value: data.egt,
      unit: "°C",
    },
    {
      name: "CHT",
      value: data.cht,
      unit: "°C",
    },
    {
      name: "Oil Pressure",
      value: data.oil_pressure,
      unit: "bar",
    },
    {
      name: "Oil Temperature",
      value: data.oil_temperature,
      unit: "°C",
    },
    {
      name: "Vibration",
      value: data.vibration,
      unit: "mm/s",
    },
    {
      name: "Fuel Flow",
      value: data.fuel_flow,
      unit: "L/hr",
    },
    {
      name: "Throttle",
      value: data.throttle,
      unit: "%",
    },
  ];

  return (
    <div className="sensor-panel">
      <div className="sensor-header">
        <div>
          <h2>Sensor Overview</h2>
          <p>Live engine telemetry</p>
        </div>

        <div className="live-indicator">
          <span></span>
          LIVE
        </div>
      </div>

      <div className="sensor-grid">
        {sensors.map((sensor) => (
          <div
            className="sensor-card"
            key={sensor.name}
          >
            <span className="sensor-name">
              {sensor.name}
            </span>

            <div className="sensor-value">
              {Number(sensor.value).toFixed(
                sensor.unit === "RPM" ? 0 : 1
              )}
            </div>

            <span className="sensor-unit">
              {sensor.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}