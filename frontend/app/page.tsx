"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef, useMemo } from "react";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BrainCircuit,
  Gauge,
  Home as HomeIcon,
  Plane,
  Settings,
  ShieldCheck,
  Thermometer,
  Wrench,
  Droplets,
  Wind,
  Database,
  Clock3,
  Play,
  Pause,
  RotateCcw,
  History,
  Zap,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/* =========================================================
   DIGITAL TWIN
   ========================================================= */

const DigitalTwin = dynamic(
  () => import("./components/DigitalTwin"),
  {
    ssr: false,
  }
);

/* =========================================================
   TYPES
   ========================================================= */

type EngineData = {
  timestamp?: string;
  rpm?: number;
  egt?: number;
  cht?: number;
  oil_pressure?: number;
  oil_temperature?: number;
  vibration?: number;
  fuel_flow?: number;
  throttle?: number;
};

type HealthData = {
  health?: number;
  health_score?: number;
  status?: string;
  severity?: string;
  reason?: string;
  recommendation?: string;
};

type FaultData = {
  fault?: string;
  confidence?: number;
  severity?: string;
  evidence?: string[];
  recommendation?: string;
};

type RulData = {
  rul_min_hours?: number;
  rul_max_hours?: number;
  confidence?: number;
  status?: string;
  reason?: string;
  recommendation?: string;
};

type MissionRiskData = {
  risk_score?: number;
  risk_level?: string;
  risk_factors?: string[];
  decision?: string;
  recommendation?: string;

  mission_profile?: {
    mission_type?: string;
    altitude?: number;
    ambient_temperature?: number;
    throttle?: number;
    mission_duration?: number;
  };

  engine_condition?: {
    health?: number;
    fault?: string;
    fault_severity?: string;
    rul_min_hours?: number;
    rul_max_hours?: number;
  };
};

type AnomalyData = {
  status?: string;
  anomaly?: boolean;
  anomaly_score?: number;
  confidence?: number;
  severity?: string;
  message?: string;
  samples_analyzed?: number;
  features_used?: string[];
};

type PipelineData = {
  engine_data?: EngineData;
  health?: HealthData;
  fault?: FaultData;
  rul?: RulData;
  mission_risk?: MissionRiskData;
  anomaly?: AnomalyData;
};

type TelemetryHistory = {
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

type ReplayState = {
  timestamp: string;
  engine_data: EngineData;
  health: HealthData;
  fault: FaultData;
  rul: RulData;
  mission_risk: MissionRiskData;
  fault_mode: string;
};

/* =========================================================
   API
   ========================================================= */

const API_BASE_URL = "http://127.0.0.1:8001";

type ChartRangeKey =
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "6h"
  | "12h"
  | "24h"
  | "all";


/* =========================================================
   LOCAL ENGINE SIMULATION FALLBACK
   ========================================================= */

function generateLocalSimulation(
  faultMode: string,
  missionAltitude = 4500,
  missionTemperature = 32,
  missionThrottle = 70,
  missionDuration = 20,
  missionType = "ISR",
  timeMs = Date.now()
): PipelineData {
  const t = timeMs / 1000;
  const wave = (speed: number, amplitude: number) =>
    Math.sin(t * speed) * amplitude;
  const noise = (amplitude: number) =>
    wave(1.7, amplitude) + wave(0.63, amplitude * 0.45);

  const mode = faultMode.toLowerCase();
  const baseThrottle = 72 + wave(0.18, 7);
  const throttle = Math.max(45, Math.min(95, baseThrottle));
  const load = throttle / 100;

  let rpm = 2050 + load * 650 + noise(35);
  let egt = 575 + load * 170 + noise(7);
  let cht = 125 + load * 38 + noise(2.5);
  let oilPressure = 2.8 + (rpm / 3000) * 2.0 + noise(0.06);
  let oilTemperature = 72 + load * 27 + noise(1.2);
  let vibration = 1.3 + load * 0.9 + Math.abs(noise(0.18));
  let fuelFlow = 12 + load * 10 + noise(0.3);

  if (mode === "overheating") {
    egt += 110 + wave(0.7, 12);
    cht += 42;
    oilTemperature += 28;
    rpm -= 80;
  } else if (mode === "low_oil") {
    oilPressure = 1.55 + Math.abs(wave(0.8, 0.28));
    oilTemperature += 18;
    vibration += 0.7;
  } else if (mode === "high_vibration") {
    vibration = 5.0 + Math.abs(wave(1.9, 1.5));
    rpm += wave(2.4, 70);
  } else if (mode === "misfire") {
    const pulse = Math.sin(t * 5.2);
    rpm -= pulse > 0 ? 260 : 20;
    egt += pulse > 0 ? 65 : 5;
    vibration += pulse > 0 ? 1.8 : 0.2;
    fuelFlow -= pulse > 0 ? 2.0 : 0;
  } else if (mode === "injector") {
    egt += 75;
    fuelFlow += 5.5 + Math.abs(wave(1.2, 1.5));
    rpm -= 120;
    vibration += 0.6;
  }

  rpm = Math.max(1200, Math.min(2900, rpm));
  egt = Math.max(450, egt);
  cht = Math.max(90, cht);
  oilPressure = Math.max(0.5, oilPressure);
  oilTemperature = Math.max(55, oilTemperature);
  vibration = Math.max(0.5, vibration);
  fuelFlow = Math.max(5, fuelFlow);

  let health = 100;
  if (egt > 800) health -= 30;
  else if (egt > 750) health -= 20;
  else if (egt > 720) health -= 10;
  if (cht > 190) health -= 25;
  else if (cht > 175) health -= 15;
  if (oilPressure < 2) health -= 30;
  else if (oilPressure < 3) health -= 15;
  if (vibration > 6) health -= 25;
  else if (vibration > 4) health -= 15;
  if (mode === "misfire") health -= 12;
  if (mode === "injector") health -= 10;
  health = Math.max(15, Math.min(100, health + wave(0.23, 1.5)));

  let fault = "NO SIGNIFICANT FAULT";
  let severity = "LOW";
  if (mode === "overheating") { fault = "POSSIBLE OVERHEATING"; severity = health < 70 ? "CRITICAL" : "HIGH"; }
  else if (mode === "low_oil") { fault = "POSSIBLE LUBRICATION PROBLEM"; severity = "HIGH"; }
  else if (mode === "high_vibration") { fault = "POSSIBLE MECHANICAL/VIBRATION PROBLEM"; severity = "HIGH"; }
  else if (mode === "misfire") { fault = "POSSIBLE MISFIRE"; severity = "HIGH"; }
  else if (mode === "injector") { fault = "POSSIBLE INJECTOR PROBLEM"; severity = "HIGH"; }

  const healthRounded = Math.round(health);
  const status = healthRounded >= 85 ? "NORMAL" : healthRounded >= 70 ? "WARNING" : healthRounded >= 50 ? "CRITICAL" : "DANGER";
  const healthSeverity = healthRounded >= 85 ? "LOW" : healthRounded >= 70 ? "MEDIUM" : "HIGH";

  let rulMin = healthRounded >= 90 ? 80 : healthRounded >= 75 ? 60 : healthRounded >= 60 ? 40 : healthRounded >= 40 ? 20 : 5;
  let rulMax = healthRounded >= 90 ? 120 : healthRounded >= 75 ? 90 : healthRounded >= 60 ? 65 : healthRounded >= 40 ? 40 : 20;
  if (severity === "CRITICAL") { rulMin = Math.max(1, rulMin - 8); rulMax = Math.max(2, rulMax - 15); }
  else if (severity === "HIGH") { rulMin = Math.max(1, rulMin - 6); rulMax = Math.max(2, rulMax - 10); }
  const rulStatus = rulMax > 60 ? "HEALTHY" : rulMax > 30 ? "MONITOR" : rulMax > 10 ? "MAINTENANCE REQUIRED" : "URGENT INSPECTION";

  let risk = 8 + (100 - healthRounded) * 0.55;
  if (mode !== "normal") risk += 18;
  risk += Math.max(0, missionAltitude - 5000) / 1000 * 5;
  risk += Math.max(0, missionTemperature - 35) * 1.5;
  risk += Math.max(0, missionThrottle - 80) * 0.7;
  risk += Math.max(0, missionDuration - 30) * 0.35;
  risk = Math.max(0, Math.min(100, risk));
  const riskScore = Math.round(risk);
  const riskLevel = riskScore >= 75 ? "CRITICAL" : riskScore >= 55 ? "HIGH" : riskScore >= 30 ? "MEDIUM" : "LOW";
  const decision = riskLevel === "CRITICAL" ? "MISSION NOT RECOMMENDED" : riskLevel === "HIGH" ? "MISSION REVIEW REQUIRED" : riskLevel === "MEDIUM" ? "PROCEED WITH CAUTION" : "MISSION ACCEPTABLE";

  const now = new Date(timeMs).toISOString();
  return {
    engine_data: {
      timestamp: now, rpm, egt, cht, oil_pressure: oilPressure,
      oil_temperature: oilTemperature, vibration, fuel_flow: fuelFlow, throttle,
    },
    health: {
      health: healthRounded, health_score: healthRounded, status,
      severity: healthSeverity,
      reason: mode === "normal" ? "Simulated engine parameters are within the normal operating range." : `Simulation is injecting ${faultMode} conditions into the engine model.`,
      recommendation: mode === "normal" ? "Continue normal monitoring." : "Investigate the detected condition and plan maintenance.",
    },
    fault: {
      fault, confidence: mode === "normal" ? 95 : 90, severity,
      evidence: mode === "normal" ? ["Engine parameters stable"] : [`${faultMode} condition simulated`],
      recommendation: mode === "normal" ? "Continue monitoring." : "Inspect the affected engine system.",
    },
    rul: {
      rul_min_hours: rulMin, rul_max_hours: rulMax, confidence: 82,
      status: rulStatus,
      reason: mode === "normal" ? "Stable simulated engine condition." : `RUL reduced for the simulated ${faultMode} condition.`,
      recommendation: rulMax > 30 ? "Plan preventive inspection." : "Perform engine inspection before the next mission.",
    },
    mission_risk: {
      risk_score: riskScore, risk_level: riskLevel,
      risk_factors: ["Altitude", "Ambient temperature", "Throttle", "Mission duration", "Engine condition"],
      decision,
      recommendation: decision,
      mission_profile: { mission_type: missionType, altitude: missionAltitude, ambient_temperature: missionTemperature, throttle: missionThrottle, mission_duration: missionDuration },
      engine_condition: { health: healthRounded, fault, fault_severity: severity, rul_min_hours: rulMin, rul_max_hours: rulMax },
    },
    anomaly: {
      status: "SIMULATED", anomaly: mode !== "normal", anomaly_score: mode === "normal" ? 0.08 : 0.82,
      confidence: 88, severity: mode === "normal" ? "LOW" : "HIGH",
      message: mode === "normal" ? "No simulated anomaly detected." : `Simulated ${faultMode} anomaly detected.`,
      samples_analyzed: 1,
    },
  };
}

const CHART_RANGES: Array<{
  key: ChartRangeKey;
  label: string;
  minutes: number | null;
  historyLimit: number;
}> = [
  { key: "5m", label: "Last 5 min", minutes: 5, historyLimit: 300 },
  { key: "15m", label: "Last 15 min", minutes: 15, historyLimit: 600 },
  { key: "30m", label: "Last 30 min", minutes: 30, historyLimit: 1200 },
  { key: "1h", label: "Last 1 hour", minutes: 60, historyLimit: 2500 },
  { key: "6h", label: "Last 6 hours", minutes: 360, historyLimit: 12000 },
  { key: "12h", label: "Last 12 hours", minutes: 720, historyLimit: 24000 },
  { key: "24h", label: "Last 24 hours", minutes: 1440, historyLimit: 50000 },
  { key: "all", label: "All available", minutes: null, historyLimit: 50000 },
];

/* =========================================================
   MAIN PAGE
   ========================================================= */

export default function HomePage() {
  /* =========================================================
     LIVE DATA
     ========================================================= */

  const [engineData, setEngineData] =
    useState<EngineData | null>(null);

  const [pipelineData, setPipelineData] =
    useState<PipelineData | null>(null);

  const [telemetryHistory, setTelemetryHistory] =
    useState<TelemetryHistory[]>([]);

  const [connected, setConnected] =
    useState(false);

  const [selectedFault, setSelectedFault] =
    useState("normal");

  const [lastUpdate, setLastUpdate] =
    useState("--:--:--");

  const [chartRange, setChartRange] =
    useState<ChartRangeKey>("15m");

  const selectedChartRange =
    CHART_RANGES.find((range) => range.key === chartRange) ??
    CHART_RANGES[0];

  const historyRefreshMs =
    selectedChartRange.minutes !== null && selectedChartRange.minutes <= 60
      ? 5000
      : selectedChartRange.minutes === 360
        ? 15000
        : 60000;

  /* =========================================================
     MISSION SCENARIO CONTROLS
     ========================================================= */

  const [missionAltitude, setMissionAltitude] =
    useState(4500);

  const [missionTemperature, setMissionTemperature] =
    useState(32);

  const [missionThrottle, setMissionThrottle] =
    useState(70);

  const [missionDuration, setMissionDuration] =
    useState(20);

  const [missionType, setMissionType] =
    useState("ISR");

  const [missionLoading, setMissionLoading] =
    useState(false);

  const [missionMessage, setMissionMessage] =
    useState(
      "Configure mission conditions and run the scenario."
    );

  const [missionResult, setMissionResult] =
    useState<PipelineData | null>(null);

  /* =========================================================
     MISSION REPLAY
     ========================================================= */

  const [replayData, setReplayData] =
    useState<ReplayState[]>([]);

  const [replayIndex, setReplayIndex] =
    useState(0);

  const [isReplayPlaying, setIsReplayPlaying] =
    useState(false);

  const [replayMode, setReplayMode] =
    useState(false);

  const [replaySpeed, setReplaySpeed] =
    useState(1);

  const replayTimerRef =
    useRef<NodeJS.Timeout | null>(null);

  /* =========================================================
     WARNING ALARM + SCREEN SHAKE
     ========================================================= */

  const [alarmMuted, setAlarmMuted] =
    useState(false);

  const [shakeActive, setShakeActive] =
    useState(false);

  const alarmContextRef =
    useRef<AudioContext | null>(null);

  const alarmIntervalRef =
    useRef<number | null>(null);

  const previousDangerRef =
    useRef(false);

  const shakeTimerRef =
    useRef<NodeJS.Timeout | null>(null);

  const shakeIntervalRef =
    useRef<number | null>(null);

  const [alertAcknowledged, setAlertAcknowledged] =
    useState(false);


  /* =========================================================
     RUN MISSION SCENARIO
     ========================================================= */

  const runMissionScenario = async () => {
    if (missionLoading) {
      return;
    }

    setMissionLoading(true);

    setMissionMessage(
      "Running mission scenario..."
    );

    try {
      const params = new URLSearchParams({
        fault: selectedFault,
        altitude: String(missionAltitude),
        ambient_temperature: String(
          missionTemperature
        ),
        throttle: String(missionThrottle),
        mission_duration: String(
          missionDuration
        ),
        mission_type: missionType,
      });

      const response = await fetch(
        `${API_BASE_URL}/engine/mission-scenario?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Mission scenario failed: ${response.status}`
        );
      }

      const data: PipelineData =
        await response.json();

      setMissionResult(data);
      setPipelineData(data);

      setEngineData(
        data.engine_data ?? null
      );

      setConnected(true);

      setLastUpdate(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );

      setMissionMessage(
        "Mission scenario completed successfully."
      );
    } catch (error) {
      console.error(
        "Mission scenario error:",
        error
      );

      setMissionMessage(
        "Unable to run mission scenario. Check the backend."
      );
    } finally {
      setMissionLoading(false);
    }
  };

  /* =========================================================
     BACKEND CONNECTION
     ========================================================= */

  useEffect(() => {
    let isMounted = true;

    const fetchEngineData = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/engine/status?fault=${selectedFault}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Backend request failed: ${response.status}`
          );
        }

        const data: PipelineData =
          await response.json();

        if (!isMounted) return;

        setPipelineData(data);

        setEngineData(
          data.engine_data ?? null
        );

        setConnected(true);

        setLastUpdate(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch (error) {
        console.warn("Backend unavailable; running local engine simulation.", error);

        if (!isMounted) return;

        const simulated = generateLocalSimulation(
          selectedFault,
          missionAltitude,
          missionTemperature,
          missionThrottle,
          missionDuration,
          missionType
        );
        setPipelineData(simulated);
        setEngineData(simulated.engine_data ?? null);
        setConnected(true);
        setLastUpdate(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );

        setTelemetryHistory((previous) => {
          const d = simulated.engine_data!;
          const point: TelemetryHistory = {
            id: Date.now(),
            timestamp: d.timestamp ?? new Date().toISOString(),
            rpm: d.rpm ?? 0,
            egt: d.egt ?? 0,
            cht: d.cht ?? 0,
            oil_pressure: d.oil_pressure ?? 0,
            oil_temperature: d.oil_temperature ?? 0,
            vibration: d.vibration ?? 0,
            fuel_flow: d.fuel_flow ?? 0,
            throttle: d.throttle ?? 0,
            fault_mode: selectedFault,
          };
          return [...previous, point].slice(-900);
        });
      }
    };

    const fetchTelemetryHistory = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/engine/history?limit=${selectedChartRange.historyLimit}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `History request failed: ${response.status}`
          );
        }

        const data =
          await response.json();

        if (!isMounted) return;

        setTelemetryHistory(
          data.telemetry ?? []
        );
      } catch (error) {
        console.error(
          "Telemetry history error:",
          error
        );
      }
    };

    const fetchReplayData = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/engine/replay?limit=50`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Replay request failed: ${response.status}`
          );
        }

        const data =
          await response.json();

        if (!isMounted) return;

        setReplayData(
          data.replay ?? []
        );

        setReplayIndex(0);
      } catch (error) {
        console.error(
          "Mission replay error:",
          error
        );
      }
    };

    fetchEngineData();
    fetchTelemetryHistory();
    fetchReplayData();

    const engineInterval =
      setInterval(
        fetchEngineData,
        2000
      );

    const historyInterval =
      setInterval(
        fetchTelemetryHistory,
        historyRefreshMs
      );

    return () => {
      isMounted = false;

      clearInterval(
        engineInterval
      );

      clearInterval(
        historyInterval
      );
    };
  }, [
    selectedFault,
    chartRange,
    selectedChartRange.historyLimit,
    historyRefreshMs,
    missionAltitude,
    missionDuration,
    missionTemperature,
    missionThrottle,
    missionType,
  ]);

  /* =========================================================
     CHART TIME WINDOW
     ========================================================= */

  const chartData = useMemo(() => {
    const now = telemetryHistory.length
      ? Date.parse(telemetryHistory[telemetryHistory.length - 1].timestamp)
      : 0;
    const windowStart =
      selectedChartRange.minutes === null
        ? 0
        : now - selectedChartRange.minutes * 60 * 1000;

    const filtered = telemetryHistory.filter((point) => {
      const timestamp = Date.parse(point.timestamp);
      return Number.isFinite(timestamp) && timestamp >= windowStart;
    });

    // Keep the raw history intact, but downsample very large windows
    // so Recharts stays smooth on the dashboard.
    const maxChartPoints = 900;
    const step =
      filtered.length > maxChartPoints
        ? Math.ceil(filtered.length / maxChartPoints)
        : 1;

    return filtered
      .filter((_, index) => index % step === 0)
      .map((point) => ({
        time:
          selectedChartRange.minutes !== null &&
          selectedChartRange.minutes <= 60
            ? new Date(point.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : new Date(point.timestamp).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
        timestamp: point.timestamp,
        rpm: point.rpm,
        egt: point.egt,
        cht: point.cht,
        oil_pressure: point.oil_pressure,
        oil_temperature: point.oil_temperature,
        vibration: point.vibration,
        fuel_flow: point.fuel_flow,
        throttle: point.throttle,
      }));
  }, [telemetryHistory, selectedChartRange]);

  const availableHistoryMinutes = useMemo(() => {
    if (telemetryHistory.length < 2) return 0;

    const timestamps = telemetryHistory
      .map((point) => Date.parse(point.timestamp))
      .filter(Number.isFinite);

    if (timestamps.length < 2) return 0;

    return Math.max(0, (Math.max(...timestamps) - Math.min(...timestamps)) / 60000);
  }, [telemetryHistory]);

  /* =========================================================
     MISSION REPLAY TIMER
     ========================================================= */

  useEffect(() => {
    if (!replayMode) {
      return;
    }

    if (!isReplayPlaying) {
      return;
    }

    if (replayData.length === 0) {
      return;
    }

    if (replayIndex >= replayData.length - 1) {
      return;
    }

    replayTimerRef.current =
      setTimeout(() => {
        setReplayIndex(
          (previous) => previous + 1
        );
        if (replayIndex + 1 >= replayData.length - 1) {
          setIsReplayPlaying(false);
        }
      }, 1000 / replaySpeed);

    return () => {
      if (replayTimerRef.current) {
        clearTimeout(
          replayTimerRef.current
        );
      }
    };
  }, [
    replayMode,
    isReplayPlaying,
    replayIndex,
    replaySpeed,
    replayData.length,
  ]);

  /* =========================================================
     REPLAY CONTROLS
     ========================================================= */

  const currentReplay =
    replayData.length > 0
      ? replayData[
          Math.min(
            replayIndex,
            replayData.length - 1
          )
        ]
      : null;

  const startReplay = () => {
    if (replayData.length === 0) {
      return;
    }

    setReplayMode(true);
    setIsReplayPlaying(true);
  };

  const pauseReplay = () => {
    setIsReplayPlaying(false);
  };

  const resetReplay = () => {
    setIsReplayPlaying(false);
    setReplayIndex(0);
  };

  const exitReplay = () => {
    setIsReplayPlaying(false);
    setReplayMode(false);
    setReplayIndex(0);
  };

  /* =========================================================
     ACTIVE DIGITAL TWIN DATA
     ========================================================= */

  const activeEngineData =
    replayMode && currentReplay
      ? currentReplay.engine_data
      : engineData;

  const activeHealth =
    replayMode && currentReplay
      ? currentReplay.health
      : pipelineData?.health;

  const activeFault =
    replayMode && currentReplay
      ? currentReplay.fault
      : pipelineData?.fault;

  const activeRul =
    replayMode && currentReplay
      ? currentReplay.rul
      : pipelineData?.rul;

  const activeMissionRisk =
    replayMode && currentReplay
      ? currentReplay.mission_risk
      : pipelineData?.mission_risk;

  /* =========================================================
     NAVIGATION
     ========================================================= */

  const navigation = [
    {
      name: "Dashboard",
      icon: HomeIcon,
      active: true,
    },
    {
      name: "Engine Health",
      icon: Gauge,
      active: false,
    },
    {
      name: "Sensors",
      icon: Activity,
      active: false,
    },
    {
      name: "Fault Detection",
      icon: AlertTriangle,
      active: false,
    },
    {
      name: "Predictions",
      icon: BrainCircuit,
      active: false,
    },
    {
      name: "Missions",
      icon: Plane,
      active: false,
    },
  ];

  /* =========================================================
     SENSOR DATA
     ========================================================= */

  const sensors = [
    {
      name: "RPM",
      value:
        activeEngineData?.rpm !== undefined
          ? activeEngineData.rpm.toFixed(0)
          : "--",
      unit: "rpm",
    },
    {
      name: "EGT",
      value:
        activeEngineData?.egt !== undefined
          ? activeEngineData.egt.toFixed(1)
          : "--",
      unit: "°C",
    },
    {
      name: "CHT",
      value:
        activeEngineData?.cht !== undefined
          ? activeEngineData.cht.toFixed(1)
          : "--",
      unit: "°C",
    },
    {
      name: "Oil Pressure",
      value:
        activeEngineData?.oil_pressure !== undefined
          ? activeEngineData.oil_pressure.toFixed(2)
          : "--",
      unit: "bar",
    },
    {
      name: "Oil Temperature",
      value:
        activeEngineData?.oil_temperature !== undefined
          ? activeEngineData.oil_temperature.toFixed(1)
          : "--",
      unit: "°C",
    },
    {
      name: "Vibration",
      value:
        activeEngineData?.vibration !== undefined
          ? activeEngineData.vibration.toFixed(2)
          : "--",
      unit: "mm/s",
    },
    {
      name: "Fuel Flow",
      value:
        activeEngineData?.fuel_flow !== undefined
          ? activeEngineData.fuel_flow.toFixed(2)
          : "--",
      unit: "L/hr",
    },
    {
      name: "Throttle",
      value:
        activeEngineData?.throttle !== undefined
          ? activeEngineData.throttle.toFixed(1)
          : "--",
      unit: "%",
    },
  ];

  /* =========================================================
     KPI DATA
     ========================================================= */

  const healthScore =
    activeHealth?.health ??
    activeHealth?.health_score;

  const healthStatus =
    activeHealth?.status ??
    "WAITING FOR DATA";

  const healthSeverity =
    activeHealth?.severity ??
    "UNKNOWN";

  const rulMin =
    activeRul?.rul_min_hours;

  const rulMax =
    activeRul?.rul_max_hours;

  const rulConfidence =
    activeRul?.confidence;

  const faultConfidence =
    activeFault?.confidence;

  const faultName =
    activeFault?.fault ??
    "NO SIGNIFICANT FAULT";

  const faultSeverity =
    activeFault?.severity ??
    "LOW";

  const riskLevel =
    activeMissionRisk?.risk_level ??
    "WAITING";

  const riskScore =
    activeMissionRisk?.risk_score;

  const missionDecision =
    activeMissionRisk?.decision ??
    "WAITING FOR ASSESSMENT";

  const replayChartData = useMemo(() => {
    const now = replayData.length
      ? Date.parse(replayData[replayData.length - 1].timestamp)
      : 0;
    const windowStart =
      selectedChartRange.minutes === null
        ? 0
        : now - selectedChartRange.minutes * 60 * 1000;

    return replayData
      .filter((entry) => {
        const timestamp = Date.parse(entry.timestamp);
        return Number.isFinite(timestamp) && timestamp >= windowStart;
      })
      .map((entry) => {
        const timestamp = Date.parse(entry.timestamp);
        return {
          timestamp,
          time:
            selectedChartRange.minutes !== null &&
            selectedChartRange.minutes <= 60
              ? new Date(timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : new Date(timestamp).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
          health:
            entry.health?.health ??
            entry.health?.health_score ??
            0,
          risk:
            entry.mission_risk?.risk_score ??
            0,
        };
      });
  }, [replayData, selectedChartRange]);

  const twinHealth =
    healthScore !== undefined ? healthScore : 0;

  /* =========================================================
     ENGINE ALERT / FAULT STATE
     ========================================================= */

  const detectedFault =
    faultName.toUpperCase();

  const detectedSeverity =
    faultSeverity.toUpperCase();

  const detectedRisk =
    riskLevel.toUpperCase();

  const hasFault =
    detectedFault !==
      "NO SIGNIFICANT FAULT" &&
    detectedFault !==
      "NO FAULT DETECTED" &&
    detectedFault !== "NONE";

  /*
     Any detected engine fault is treated as a red
     dashboard alert for the prototype demonstration.
  */

  const dangerState =
    hasFault ||
    detectedSeverity === "CRITICAL" ||
    detectedSeverity === "HIGH" ||
    detectedRisk === "CRITICAL" ||
    detectedRisk === "HIGH";

  const warningState =
    !dangerState &&
    (
      detectedSeverity === "MEDIUM" ||
      detectedRisk === "MEDIUM"
    );

  const twinState = dangerState
    ? "CRITICAL"
    : warningState
      ? "WARNING"
      : "STABLE";

  const anomalyDetected =
    Boolean(pipelineData?.anomaly?.anomaly) ||
    Boolean(
      activeFault &&
        faultName !== "NO SIGNIFICANT FAULT" &&
        faultName !== "NO FAULT DETECTED" &&
        faultName !== "NONE"
    ) ||
    (typeof (pipelineData?.anomaly?.anomaly_score ?? 0) === "number" &&
      (pipelineData?.anomaly?.anomaly_score ?? 0) > 0);

  const anomalyStatus =
    pipelineData?.anomaly?.status ??
    (anomalyDetected ? "ALERT" : "NORMAL");

  const anomalyScore =
    pipelineData?.anomaly?.anomaly_score ?? 0;

  const anomalyConfidence =
    pipelineData?.anomaly?.confidence ?? 0;

  const anomalySeverity =
    pipelineData?.anomaly?.severity ?? "LOW";

  const anomalyMessage =
    pipelineData?.anomaly?.message ??
    "Engine behaviour is consistent with normal operating parameters.";

  const anomalySamples =
    pipelineData?.anomaly?.samples_analyzed ?? 0;

  let dashboardAlertTitle =
    "ENGINE STATUS: STABLE";

  let dashboardAlertMessage =
    "No abnormal condition detected. Aircraft engine is operating normally.";

  if (
    detectedFault ===
    "POSSIBLE OVERHEATING"
  ) {
    dashboardAlertTitle =
      "⚠ ENGINE ALERT: OVERHEATING";

    dashboardAlertMessage =
      "EGT and CHT are above the safe operating range. Immediate inspection is recommended.";
  } else if (
    detectedFault ===
    "POSSIBLE LUBRICATION PROBLEM"
  ) {
    dashboardAlertTitle =
      "⚠ ENGINE ALERT: LOW OIL PRESSURE";

    dashboardAlertMessage =
      "Oil pressure is below the expected operating range. Possible lubrication problem detected.";
  } else if (
    detectedFault ===
    "POSSIBLE MECHANICAL/VIBRATION PROBLEM"
  ) {
    dashboardAlertTitle =
      "⚠ ENGINE ALERT: ABNORMAL VIBRATION";

    dashboardAlertMessage =
      "Engine vibration is significantly above the normal range. Mechanical inspection is recommended.";
  } else if (
    detectedFault ===
    "POSSIBLE MISFIRE"
  ) {
    dashboardAlertTitle =
      "⚠ ENGINE ALERT: POSSIBLE MISFIRE";

    dashboardAlertMessage =
      "Abnormal RPM, EGT and vibration patterns indicate a possible combustion problem.";
  } else if (
    detectedFault ===
    "POSSIBLE INJECTOR PROBLEM"
  ) {
    dashboardAlertTitle =
      "⚠ ENGINE ALERT: POSSIBLE INJECTOR PROBLEM";

    dashboardAlertMessage =
      "Fuel-flow and engine-temperature patterns indicate a possible injector abnormality.";
  } else if (dangerState) {
    dashboardAlertTitle =
      "⚠ ENGINE ALERT";

    dashboardAlertMessage =
      activeFault?.recommendation ??
      activeMissionRisk?.recommendation ??
      "Engine condition requires immediate attention.";
  } else if (warningState) {
    dashboardAlertTitle =
      "ENGINE STATUS: MONITOR";

    dashboardAlertMessage =
      activeFault?.recommendation ??
      activeMissionRisk?.recommendation ??
      "Engine condition requires closer monitoring.";
  }

  /* =========================================================
     WARNING ALARM + EARTHQUAKE WARNING CONTROL
     ========================================================= */

  const clearShakeTimers = () => {
    if (shakeTimerRef.current) {
      clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }

    if (shakeIntervalRef.current !== null) {
      window.clearInterval(shakeIntervalRef.current);
      shakeIntervalRef.current = null;
    }
  };

  const stopAlarm = () => {
    if (alarmIntervalRef.current !== null) {
      window.clearInterval(
        alarmIntervalRef.current
      );
      alarmIntervalRef.current = null;
    }

    if (alarmContextRef.current) {
      void alarmContextRef.current
        .suspend()
        .catch(() => undefined);
    }
  };

  const startAlarm = () => {
    if (alarmMuted || typeof window === "undefined") {
      return;
    }

    if (!alarmContextRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      alarmContextRef.current =
        new AudioContextClass();
    }

    const audioContext =
      alarmContextRef.current;

    const playPoliceSiren = () => {
      try {
        if (audioContext.state === "suspended") {
          void audioContext.resume();
        }

        const now = audioContext.currentTime;
        const oscillator =
          audioContext.createOscillator();
        const gain =
          audioContext.createGain();

        // Police-siren style: "vuy-vuy-vuy"
        // Three rising/falling sweeps over 3 seconds.
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(
          520,
          now
        );

        oscillator.frequency.linearRampToValueAtTime(
          1050,
          now + 0.5
        );
        oscillator.frequency.linearRampToValueAtTime(
          520,
          now + 1.0
        );
        oscillator.frequency.linearRampToValueAtTime(
          1050,
          now + 1.5
        );
        oscillator.frequency.linearRampToValueAtTime(
          520,
          now + 2.0
        );
        oscillator.frequency.linearRampToValueAtTime(
          1050,
          now + 2.5
        );
        oscillator.frequency.linearRampToValueAtTime(
          520,
          now + 3.0
        );

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(
          0.22,
          now + 0.08
        );
        gain.gain.setValueAtTime(
          0.22,
          now + 2.75
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + 3.0
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(now);
        oscillator.stop(now + 3.05);
      } catch (error) {
        console.warn(
          "Warning siren could not play:",
          error
        );
      }
    };

    if (alarmIntervalRef.current !== null) {
      return;
    }

    // 3 seconds siren + 3 seconds silent gap.
    playPoliceSiren();

    alarmIntervalRef.current =
      window.setInterval(
        playPoliceSiren,
        6000
      );
  };

  const startEarthquakeShake = () => {
    if (typeof window === "undefined") {
      return;
    }

    clearShakeTimers();

    const shakeForThreeSeconds = () => {
      setShakeActive(true);

      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current);
      }

      // Shake for exactly 3 seconds, then stop
      // for 3 seconds before the next shake cycle.
      shakeTimerRef.current =
        setTimeout(() => {
          setShakeActive(false);
        }, 3000);
    };

    // Start immediately when the red condition appears.
    shakeForThreeSeconds();

    // Repeat: 3 sec shake + 3 sec gap.
    shakeIntervalRef.current =
      window.setInterval(
        shakeForThreeSeconds,
        6000
      );
  };

  const stopEarthquakeShake = () => {
    clearShakeTimers();
    setShakeActive(false);
  };

  /*
     Serious/red fault:
     - 3 sec earthquake-style screen shake
     - 3 sec gap
     - repeat while red state remains active
     - 3 sec police-style "vuy-vuy-vuy" siren
     - 3 sec silent gap
     - repeat while red state remains active
  */
  useEffect(() => {
    const wasDanger =
      previousDangerRef.current;

    /*
       A new red condition starts a fresh warning cycle.
       Once the operator acknowledges it, the red indicator
       remains visible but the alarm and shaking stay stopped
       until the engine returns to normal.
    */
    if (dangerState && !wasDanger) {
      setTimeout(() => setAlertAcknowledged(false), 0);
      startEarthquakeShake();
    }

    if (dangerState && !alarmMuted && !alertAcknowledged) {
      startAlarm();
    } else {
      stopAlarm();
    }

    if (!dangerState) {
      setTimeout(() => setAlertAcknowledged(false), 0);
      setTimeout(stopEarthquakeShake, 0);
    }

    if (dangerState && alertAcknowledged) {
      setTimeout(stopEarthquakeShake, 0);
    }

    previousDangerRef.current =
      dangerState;
  }, [dangerState, alarmMuted, alertAcknowledged]);

  /* Stop alarm and shake timers when the page closes. */
  useEffect(() => {
    return () => {
      stopAlarm();
      stopEarthquakeShake();

      if (alarmContextRef.current) {
        void alarmContextRef.current
          .close()
          .catch(() => undefined);
      }
    };
  }, []);

  /* =========================================================
     RETURN UI
     ========================================================= */

  return (
    <>
      <style jsx global>{`
        @keyframes aeropulseEarthquake {
          0% { transform: translate(0, 0) rotate(0deg); }
          5% { transform: translate(-9px, 4px) rotate(-0.6deg); }
          10% { transform: translate(8px, -4px) rotate(0.6deg); }
          15% { transform: translate(-10px, -3px) rotate(-0.7deg); }
          20% { transform: translate(9px, 4px) rotate(0.7deg); }
          25% { transform: translate(-8px, -4px) rotate(-0.6deg); }
          30% { transform: translate(10px, 3px) rotate(0.6deg); }
          35% { transform: translate(-9px, -3px) rotate(-0.7deg); }
          40% { transform: translate(8px, 4px) rotate(0.6deg); }
          45% { transform: translate(-10px, -4px) rotate(-0.6deg); }
          50% { transform: translate(9px, 3px) rotate(0.7deg); }
          55% { transform: translate(-8px, -3px) rotate(-0.6deg); }
          60% { transform: translate(9px, 4px) rotate(0.6deg); }
          65% { transform: translate(-9px, -4px) rotate(-0.6deg); }
          70% { transform: translate(8px, 3px) rotate(0.5deg); }
          75% { transform: translate(-7px, -3px) rotate(-0.5deg); }
          80% { transform: translate(6px, 2px) rotate(0.4deg); }
          85% { transform: translate(-5px, -2px) rotate(-0.3deg); }
          90% { transform: translate(4px, 1px) rotate(0.2deg); }
          95% { transform: translate(-2px, -1px) rotate(-0.1deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }

        .aeropulse-shake {
          animation: aeropulseEarthquake 3s linear infinite;
        }
      `}</style>

      <main
        className={`dashboard ${
          shakeActive
            ? "aeropulse-shake"
            : ""
        }`}
      >

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-icon">
            <Plane size={22} />
          </div>

          <div>
            <h1>AEROPULSE</h1>
            <span>UAV ENGINE DIGITAL TWIN</span>
          </div>

        </div>

        <div className="system-status">

          <span
            className={`status-dot ${
              connected
                ? "online"
                : "offline"
            }`}
          />

          {connected
            ? "SYSTEM ONLINE"
            : "BACKEND OFFLINE"}

        </div>

        <nav className="navigation">

          <p className="nav-title">
            MONITORING
          </p>

          {navigation.map(
            (item) => {

              const Icon =
                item.icon;

              return (
                <div
                  key={item.name}
                  className={`nav-item ${
                    item.active
                      ? "active"
                      : ""
                  }`}
                >

                  <Icon size={18} />

                  <span>
                    {item.name}
                  </span>

                </div>
              );
            }
          )}

          <p className="nav-title secondary-title">
            SYSTEM
          </p>

          <div className="nav-item">
            <Bell size={18} />
            <span>Alerts</span>
          </div>

          <div className="nav-item">
            <Wrench size={18} />
            <span>Maintenance</span>
          </div>

          <div className="nav-item">
            <Settings size={18} />
            <span>Settings</span>
          </div>

        </nav>

        <div className="sidebar-footer">

          <ShieldCheck size={18} />

          <div>

            <strong>
              Secure Link
            </strong>

            <span>
              Telemetry encrypted
            </span>

          </div>

        </div>

      </aside>

      {/* =====================================================
          MAIN CONTENT
          ===================================================== */}

      <section className="main-content">

        {/* ===================================================
            HEADER
            =================================================== */}

        <header className="top-header">

          <div>

            <p className="eyebrow">
              UAV ENGINE MONITORING
            </p>

            <h2>
              Mission Overview
            </h2>

          </div>

          <div className="header-right">

            <div className="connection">

              <span
                className={`status-dot ${
                  connected
                    ? "online"
                    : "offline"
                }`}
              />

              {replayMode
                ? "Mission Replay"
                : connected
                  ? "Live Telemetry"
                  : "Telemetry Offline"}

            </div>

            <div className="fault-selector">

              <label htmlFor="fault-select">
                SIMULATION
              </label>

              <select
                id="fault-select"
                value={selectedFault}
                onChange={(e) =>
                  setSelectedFault(
                    e.target.value
                  )
                }
                disabled={replayMode}
              >

                <option value="normal">
                  Normal Operation
                </option>

                <option value="overheating">
                  Overheating
                </option>

                <option value="low_oil">
                  Low Oil Pressure
                </option>

                <option value="high_vibration">
                  High Vibration
                </option>

                <option value="misfire">
                  Misfire
                </option>

                <option value="injector">
                  Injector Problem
                </option>

              </select>

            </div>

            <button
              type="button"
              onClick={() => {
                if (alarmMuted) {
                  setAlarmMuted(false);
                  if (dangerState) {
                    startAlarm();
                  }
                } else {
                  setAlarmMuted(true);
                  stopAlarm();
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 11px",
                borderRadius: 8,
                border: dangerState
                  ? "1px solid rgba(255, 70, 70, 0.8)"
                  : "1px solid #334155",
                background: dangerState
                  ? "rgba(120, 0, 0, 0.18)"
                  : "transparent",
                color: dangerState
                  ? "#ff4d4d"
                  : "inherit",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
              title={
                alarmMuted
                  ? "Enable warning alarm"
                  : "Mute warning alarm"
              }
            >
              <Bell size={15} />
              {alarmMuted
                ? "Alarm Muted"
                : "Alarm On"}
            </button>

            <div className="uav-id">

              <span>
                UAV
              </span>

              <strong>
                AS-001
              </strong>

            </div>

          </div>

        </header>

        {/* ===================================================
            ENGINE ALERT BOX
            =================================================== */}

        <div
          role={dangerState ? "button" : undefined}
          tabIndex={dangerState ? 0 : undefined}
          onClick={
            dangerState
              ? () => {
                  setAlertAcknowledged(true);
                  stopAlarm();
                  stopEarthquakeShake();
                }
              : undefined
          }
          onKeyDown={
            dangerState
              ? (event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    setAlertAcknowledged(true);
                    stopAlarm();
                    stopEarthquakeShake();
                  }
                }
              : undefined
          }
          style={{
            marginTop: 18,
            marginBottom: 18,
            padding: "14px 18px",
            borderRadius: 12,

            border: dangerState
              ? "1px solid rgba(255, 60, 60, 0.9)"
              : warningState
              ? "1px solid rgba(255, 170, 0, 0.8)"
              : "1px solid rgba(80, 220, 140, 0.45)",

            background: dangerState
              ? "rgba(120, 0, 0, 0.16)"
              : warningState
              ? "rgba(120, 80, 0, 0.12)"
              : "rgba(0, 100, 50, 0.10)",

            boxShadow: dangerState
              ? "0 0 25px rgba(255, 30, 30, 0.35)"
              : warningState
              ? "0 0 18px rgba(255, 170, 0, 0.20)"
              : "0 0 12px rgba(80, 220, 140, 0.10)",
            cursor: dangerState ? "pointer" : "default",
            userSelect: "none",
          }}
        >

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >

            <AlertTriangle
              size={20}
              style={{
                color: dangerState
                  ? "#ff4d4d"
                  : warningState
                  ? "#f59e0b"
                  : "#22c55e",
              }}
            />

            <div>

              <strong
                style={{
                  color: dangerState
                    ? "#ff4d4d"
                    : warningState
                    ? "#f59e0b"
                    : "#22c55e",

                  fontSize: 14,
                }}
              >
                {dashboardAlertTitle}
              </strong>

              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "#94a3b8",
                }}
              >
                {dashboardAlertMessage}
              </p>

              {dangerState && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                    color: alertAcknowledged
                      ? "#fca5a5"
                      : "#ff4d4d",
                  }}
                >
                  {alertAcknowledged
                    ? "✓ RED ALERT ACKNOWLEDGED — Alarm and screen warning stopped. Monitoring continues."
                    : "CLICK THIS RED ALERT TO ACKNOWLEDGE — SIREN AND SCREEN WARNING WILL STOP."}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ===================================================
            REPLAY MODE BANNER
            =================================================== */}

        {replayMode && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "12px 16px",
              marginBottom: 18,
              borderRadius: 12,
              background:
                "linear-gradient(90deg, #111827, #1e293b)",
              color: "white",
              border:
                "1px solid #334155",
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >

              <History size={20} />

              <div>

                <strong>
                  MISSION REPLAY MODE
                </strong>

                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                    marginTop: 3,
                  }}
                >
                  Historical telemetry is driving the
                  Digital Twin
                </div>

              </div>

            </div>

            <button
              onClick={exitReplay}
              style={{
                border: "1px solid #64748b",
                background: "transparent",
                color: "white",
                padding: "7px 12px",
                borderRadius: 7,
                cursor: "pointer",
              }}
            >
              Exit Replay
            </button>

          </div>
        )}

        {/* ===================================================
            KPI CARDS
            =================================================== */}

        <div className="kpi-grid">

          {/* ENGINE HEALTH */}

          <div className="kpi-card health">

            <div className="kpi-header">

              <span>
                ENGINE HEALTH
              </span>

              <Activity size={19} />

            </div>

            <div className="kpi-value">

              {healthScore !== undefined
                ? Math.round(
                    healthScore
                  )
                : "--"}

              <span>
                %
              </span>

            </div>

            <p className="positive">
              ● {healthStatus}
            </p>

          </div>

          {/* RUL */}

          <div className="kpi-card">

            <div className="kpi-header">

              <span>
                RUL ESTIMATE
              </span>

              <Gauge size={19} />

            </div>

            <div className="kpi-value">

              {rulMin !== undefined &&
              rulMax !== undefined
                ? `${rulMin}-${rulMax}`
                : "--"}

              <span>
                hrs
              </span>

            </div>

            <p>
              Confidence{" "}
              {rulConfidence !== undefined
                ? `${rulConfidence}%`
                : "--"}
            </p>

          </div>

          {/* FAULT */}

          <div
            className="kpi-card"
            style={{
              border: dangerState
                ? "1px solid rgba(255, 60, 60, 0.9)"
                : "1px solid rgba(226, 232, 240, 1)",

              boxShadow: dangerState
                ? "0 0 20px rgba(255, 30, 30, 0.30)"
                : "none",
            }}
          >

            <div className="kpi-header">

              <span>
                FAULT CONFIDENCE
              </span>

              <AlertTriangle
                size={19}
                style={{
                  color: dangerState
                    ? "#ff4d4d"
                    : undefined,
                }}
              />

            </div>

            <div className="kpi-value">

              {faultConfidence !== undefined
                ? Math.round(
                    faultConfidence
                  )
                : "--"}

              <span>
                %
              </span>

            </div>

            <p
              style={{
                color: dangerState
                  ? "#ff4d4d"
                  : undefined,
                fontWeight: dangerState
                  ? 600
                  : undefined,
              }}
            >
              ● {faultName}
            </p>

          </div>

          {/* MISSION RISK */}

          <div
            className="kpi-card"
            style={{
              border: dangerState
                ? "1px solid rgba(255, 60, 60, 0.9)"
                : warningState
                ? "1px solid rgba(255, 170, 0, 0.8)"
                : "1px solid rgba(80, 220, 140, 0.4)",

              boxShadow: dangerState
                ? "0 0 24px rgba(255, 30, 30, 0.45), inset 0 0 15px rgba(255, 30, 30, 0.08)"
                : warningState
                ? "0 0 18px rgba(255, 170, 0, 0.25)"
                : "0 0 12px rgba(80, 220, 140, 0.12)",
            }}
          >

            <div className="kpi-header">

              <span>
                MISSION RISK
              </span>

              <ShieldCheck
                size={19}
                style={{
                  color: dangerState
                    ? "#ff4d4d"
                    : warningState
                    ? "#f59e0b"
                    : "#22c55e",
                }}
              />

            </div>

            <div
              className="kpi-value"
              style={{
                color: dangerState
                  ? "#ff4d4d"
                  : warningState
                  ? "#f59e0b"
                  : undefined,
              }}
            >

              {riskLevel}

            </div>

            <p
              style={{
                color: dangerState
                  ? "#ff4d4d"
                  : warningState
                  ? "#f59e0b"
                  : undefined,
                fontWeight:
                  dangerState ||
                  warningState
                    ? 600
                    : undefined,
              }}
            >

              ●{" "}

              {riskScore !== undefined
                ? `${riskScore}/100`
                : missionDecision}

            </p>

          </div>

        </div>

        {/* ===================================================
            DIGITAL TWIN + SENSOR OVERVIEW
            =================================================== */}

        <div className="main-grid">

          {/* DIGITAL TWIN */}

          <div className="panel digital-twin">

            <div className="panel-header">

              <div>

                <p className="panel-label">
                  DIGITAL TWIN
                </p>

                <h3>
                  {replayMode
                    ? "Historical Engine State"
                    : "Live Engine State"}
                </h3>

              </div>

              <span className="live-badge">

                {replayMode
                  ? "● REPLAY"
                  : connected
                    ? "● LIVE"
                    : "OFFLINE"}

              </span>

            </div>

            <DigitalTwin
              rpm={
                activeEngineData?.rpm ??
                0
              }

              health={
                twinHealth
              }

              fault={
                faultName
              }
            />

            <div className="twin-footer">

              <div>

                <span>
                  Twin Status
                </span>

                <strong
                  style={{
                    color:
                      twinState === "CRITICAL"
                        ? "#ff4d4d"
                        : twinState === "WARNING"
                        ? "#f59e0b"
                        : undefined,
                  }}
                >
                  {twinState}
                </strong>

              </div>

              <div>

                <span>
                  RPM
                </span>

                <strong>

                  {activeEngineData?.rpm !== undefined
                    ? activeEngineData.rpm.toFixed(0)
                    : "--"}

                </strong>

              </div>

              <div>

                <span>
                  Health
                </span>

                <strong>

                  {healthScore !== undefined
                    ? `${Math.round(
                        healthScore
                      )}%`
                    : "--"}

                </strong>

              </div>

              <div>

                <span>
                  Model Status
                </span>

                <strong>
                  {replayMode
                    ? "Replay Synced"
                    : connected
                      ? "Synced"
                      : "Waiting"}
                </strong>

              </div>

              <div>

                <span>
                  Update Rate
                </span>

                <strong>
                  {replayMode
                    ? `${replaySpeed}x`
                    : "2 sec"}
                </strong>

              </div>

              <div>

                <span>
                  Last Update
                </span>

                <strong>

                  {replayMode &&
                  currentReplay
                    ? new Date(
                        currentReplay.timestamp
                      ).toLocaleTimeString()
                    : lastUpdate}

                </strong>

              </div>

            </div>

          </div>

          {/* SENSOR OVERVIEW */}

          <div className="panel sensor-panel">

            <div className="panel-header">

              <div>

                <p className="panel-label">
                  {replayMode
                    ? "REPLAY TELEMETRY"
                    : "REAL-TIME TELEMETRY"}
                </p>

                <h3>
                  Sensor Overview
                </h3>

              </div>

              <Activity size={20} />

            </div>

            <div className="sensor-list">

              {sensors.map(
                (sensor) => (

                  <div
                    className="sensor-row"
                    key={sensor.name}
                  >

                    <div className="sensor-name">

                      <div className="sensor-icon">

                        {sensor.name ===
                        "Vibration" ? (

                          <Wind size={16} />

                        ) : sensor.name ===
                          "RPM" ? (

                          <Activity size={16} />

                        ) : sensor.name ===
                            "Oil Pressure" ||
                          sensor.name ===
                            "Oil Temperature" ? (

                          <Droplets size={16} />

                        ) : (

                          <Thermometer
                            size={16}
                          />

                        )}

                      </div>

                      <span>
                        {sensor.name}
                      </span>

                    </div>

                    <div className="sensor-reading">

                      <strong>
                        {sensor.value}
                      </strong>

                      <span>
                        {sensor.unit}
                      </span>

                    </div>

                    <span
                      className={`sensor-status ${
                        replayMode
                          ? "sensor-live"
                          : connected
                            ? "sensor-live"
                            : "sensor-offline"
                      }`}
                    >

                      {replayMode
                        ? "REPLAY"
                        : connected
                          ? "LIVE"
                          : "OFFLINE"}

                    </span>

                  </div>

                )
              )}

            </div>

            <div className="telemetry-footer">

              <span>
                ● Data source:{" "}
                {replayMode
                  ? "PostgreSQL History"
                  : "Engine Simulator"}
              </span>

              <span>
                {replayMode
                  ? "Historical"
                  : connected
                    ? "Streaming"
                    : "Disconnected"}
              </span>

            </div>

          </div>

        </div>

        {/* ===================================================
            MISSION REPLAY
            =================================================== */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <p className="panel-label">
                MISSION ANALYSIS
              </p>

              <h3>
                Mission Replay
              </h3>

            </div>

            <History size={20} />

          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              marginBottom: 18,
            }}
          >

            {!replayMode ? (

              <button
                onClick={startReplay}
                disabled={
                  replayData.length === 0
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding:
                    "9px 15px",
                  border: "none",
                  borderRadius: 8,
                  background:
                    "#111827",
                  color: "white",
                  cursor:
                    replayData.length ===
                    0
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    replayData.length ===
                    0
                      ? 0.5
                      : 1,
                }}
              >
                <Play size={16} />
                Start Replay
              </button>

            ) : (

              <>
                <button
                  onClick={() =>
                    setIsReplayPlaying(
                      (previous) =>
                        !previous
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding:
                      "9px 15px",
                    border: "none",
                    borderRadius: 8,
                    background:
                      "#111827",
                    color: "white",
                    cursor: "pointer",
                  }}
                >

                  {isReplayPlaying ? (
                    <Pause size={16} />
                  ) : (
                    <Play size={16} />
                  )}

                  {isReplayPlaying
                    ? "Pause"
                    : "Play"}

                </button>

                <button
                  onClick={
                    resetReplay
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding:
                      "9px 15px",
                    border:
                      "1px solid #cbd5e1",
                    borderRadius: 8,
                    background:
                      "white",
                    cursor: "pointer",
                  }}
                >
                  <RotateCcw size={16} />
                  Reset
                </button>

              </>

            )}

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginLeft: 5,
                fontSize: 13,
              }}
            >

              Speed

              <select
                value={replaySpeed}
                onChange={(e) =>
                  setReplaySpeed(
                    Number(
                      e.target.value
                    )
                  )
                }
                style={{
                  padding:
                    "7px 10px",
                  border:
                    "1px solid #cbd5e1",
                  borderRadius: 7,
                }}
              >

                <option value={0.5}>
                  0.5x
                </option>

                <option value={1}>
                  1x
                </option>

                <option value={2}>
                  2x
                </option>

                <option value={4}>
                  4x
                </option>

              </select>

            </label>

            <span
              style={{
                marginLeft: "auto",
                fontSize: 13,
                color: "#64748b",
              }}
            >
              {replayData.length} historical samples
            </span>

          </div>

          <div
            style={{
              marginBottom: 20,
            }}
          >

            <input
              type="range"
              min={0}
              max={
                Math.max(
                  0,
                  replayData.length - 1
                )
              }
              value={replayIndex}
              onChange={(e) => {
                setReplayMode(true);
                setIsReplayPlaying(false);
                setReplayIndex(
                  Number(
                    e.target.value
                  )
                );
              }}
              disabled={
                replayData.length === 0
              }
              style={{
                width: "100%",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                marginTop: 6,
                fontSize: 12,
                color: "#64748b",
              }}
            >

              <span>
                0
              </span>

              <span>
                Frame{" "}
                {replayData.length > 0
                  ? replayIndex + 1
                  : 0}{" "}
                /{" "}
                {replayData.length}
              </span>

              <span>
                {replayData.length > 0
                  ? new Date(
                      replayData[
                        replayData.length -
                          1
                      ].timestamp
                    ).toLocaleTimeString()
                  : "--:--:--"}
              </span>

            </div>

          </div>

          {currentReplay ? (

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
              }}
            >

              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <span
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  REPLAY RPM
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: 22,
                    marginTop: 4,
                  }}
                >
                  {currentReplay.engine_data.rpm?.toFixed(
                    0
                  ) ?? "--"}
                </strong>

              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <span
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  ENGINE HEALTH
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: 22,
                    marginTop: 4,
                  }}
                >
                  {Math.round(
                    currentReplay.health.health ??
                    currentReplay.health.health_score ??
                    0
                  )}
                  %
                </strong>

              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <span
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  FAULT
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: 14,
                    marginTop: 7,
                  }}
                >
                  {currentReplay.fault.fault ??
                    "NONE"}
                </strong>

              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <span
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  RUL
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: 18,
                    marginTop: 5,
                  }}
                >
                  {currentReplay.rul.rul_min_hours ??
                    "--"}
                  -
                  {currentReplay.rul.rul_max_hours ??
                    "--"}{" "}
                  hrs
                </strong>

              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <span
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  MISSION RISK
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: 18,
                    marginTop: 5,
                  }}
                >
                  {currentReplay.mission_risk.risk_level ??
                    "--"}
                </strong>

              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <span
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  FAULT MODE
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: 14,
                    marginTop: 7,
                  }}
                >
                  {currentReplay.fault_mode}
                </strong>

              </div>

            </div>

          ) : (

            <div
              style={{
                padding: 25,
                textAlign: "center",
                color: "#64748b",
              }}
            >
              No replay data available.
              Generate telemetry first.
            </div>

          )}

        </div>

        {/* ===================================================
            POSTGRESQL HISTORICAL TELEMETRY
            =================================================== */}

        <div className="panel telemetry-history-panel">

          <div className="panel-header">

            <div>

              <p className="panel-label">
                POSTGRESQL HISTORY
              </p>

              <h3>
                Engine Telemetry Trends — {selectedChartRange.label}
              </h3>

            </div>

            <Database size={20} />

          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <Clock3 size={16} style={{ color: "#64748b" }} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                marginRight: 4,
              }}
            >
              TIME RANGE
            </span>

            {CHART_RANGES.map((range) => (
              <button
                key={range.key}
                type="button"
                onClick={() => setChartRange(range.key)}
                style={{
                  padding: "7px 11px",
                  borderRadius: 7,
                  border:
                    chartRange === range.key
                      ? "1px solid #0f172a"
                      : "1px solid #cbd5e1",
                  background:
                    chartRange === range.key
                      ? "#0f172a"
                      : "white",
                  color:
                    chartRange === range.key
                      ? "white"
                      : "#475569",
                  fontSize: 12,
                  fontWeight: chartRange === range.key ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {range.label}
              </button>
            ))}

            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: "#64748b",
              }}
            >
              {chartData.length} plotted points
              {availableHistoryMinutes > 0
                ? ` • ${availableHistoryMinutes < 60
                    ? `${Math.round(availableHistoryMinutes)} min available`
                    : `${(availableHistoryMinutes / 60).toFixed(1)} hr available`}`
                : ""}
            </span>
          </div>

          {chartData.length > 0 ? (

            <div
              className="telemetry-chart"
              style={{
                width: "100%",
                height: 320,
              }}
            >

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <LineChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 20,
                    left: 0,
                    bottom: 10,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="time"
                    interval="preserveStartEnd"
                    tick={{
                      fontSize: 11,
                    }}
                  />

                  <YAxis />

                  <Tooltip />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="rpm"
                    name="RPM"
                    strokeWidth={2}
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="egt"
                    name="EGT"
                    strokeWidth={2}
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="cht"
                    name="CHT"
                    strokeWidth={2}
                    dot={false}
                  />

                </LineChart>

              </ResponsiveContainer>

            </div>

          ) : (

            <div className="history-empty">

              <Database size={24} />

              <span>
                Waiting for historical telemetry...
              </span>

            </div>

          )}

          <div className="history-footer">

            <span>

              <Database size={14} />

              PostgreSQL Connected

            </span>

            <span>

              <Clock3 size={14} />

              {telemetryHistory.length} records

            </span>

          </div>

        </div>

        {/* ===================================================
            REPLAY TREND
            =================================================== */}

        {replayData.length > 0 && (

          <div className="panel">

            <div className="panel-header">

              <div>

                <p className="panel-label">
                  MISSION REPLAY ANALYTICS
                </p>

                <h3>
                  Historical Health & Risk
                </h3>

              </div>

              <Zap size={20} />

            </div>

            <div
              style={{
                width: "100%",
                height: 280,
              }}
            >

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <LineChart
                  data={replayChartData}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="time"
                    tick={{
                      fontSize: 11,
                    }}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                  />

                  <Tooltip
                    labelFormatter={(label) => `Time: ${label}`}
                  />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="health"
                    name="Health %"
                    strokeWidth={2}
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="risk"
                    name="Mission Risk"
                    strokeWidth={2}
                    dot={false}
                  />

                </LineChart>

              </ResponsiveContainer>

            </div>

          </div>

        )}

        {/* ===================================================
            SENSOR TREND CARDS
            =================================================== */}

        <div className="trend-grid">

          {/* OIL PRESSURE */}

          <div className="panel mini-chart">

            <div className="panel-header">

              <div>

                <p className="panel-label">
                  LUBRICATION
                </p>

                <h3>
                  Oil Pressure
                </h3>

              </div>

              <Droplets size={19} />

            </div>

            <div
              style={{
                width: "100%",
                height: 180,
              }}
            >

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <LineChart
                  data={chartData}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="time"
                    hide
                  />

                  <YAxis
                    width={35}
                  />

                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="oil_pressure"
                    name="Oil Pressure"
                    strokeWidth={2}
                    dot={false}
                  />

                </LineChart>

              </ResponsiveContainer>

            </div>

          </div>

          {/* VIBRATION */}

          <div className="panel mini-chart">

            <div className="panel-header">

              <div>

                <p className="panel-label">
                  MECHANICAL HEALTH
                </p>

                <h3>
                  Vibration
                </h3>

              </div>

              <Wind size={19} />

            </div>

            <div
              style={{
                width: "100%",
                height: 180,
              }}
            >

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <LineChart
                  data={chartData}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="time"
                    hide
                  />

                  <YAxis
                    width={35}
                  />

                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="vibration"
                    name="Vibration"
                    strokeWidth={2}
                    dot={false}
                  />

                </LineChart>

              </ResponsiveContainer>

            </div>

          </div>

        </div>

        {/* ===================================================
            AI ANOMALY DETECTION
            =================================================== */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <p className="panel-label">
                ARTIFICIAL INTELLIGENCE
              </p>

              <h3>
                AI Anomaly Detection
              </h3>

            </div>

            <BrainCircuit size={21} />

          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
            }}
          >

            <div
              style={{
                padding: 16,
                borderRadius: 10,
                background:
                  anomalyDetected
                    ? "#fff7ed"
                    : "#f8fafc",
                border:
                  anomalyDetected
                    ? "1px solid #fed7aa"
                    : "1px solid #e2e8f0",
              }}
            >

              <span
                style={{
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                AI STATUS
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: 7,
                  fontSize: 16,
                }}
              >
                {anomalyStatus}
              </strong>

            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 10,
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
              }}
            >

              <span
                style={{
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                ANOMALY SCORE
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: 7,
                  fontSize: 22,
                }}
              >
                {anomalyScore}
              </strong>

            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 10,
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
              }}
            >

              <span
                style={{
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                CONFIDENCE
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: 7,
                  fontSize: 22,
                }}
              >
                {anomalyConfidence}%
              </strong>

            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 10,
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
              }}
            >

              <span
                style={{
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                SEVERITY
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: 7,
                  fontSize: 16,
                }}
              >
                {anomalySeverity}
              </strong>

            </div>

          </div>

          <div
            style={{
              marginTop: 15,
              padding: 15,
              borderRadius: 9,
              background:
                anomalyDetected
                  ? "#fff7ed"
                  : "#f8fafc",
              border:
                anomalyDetected
                  ? "1px solid #fed7aa"
                  : "1px solid #e2e8f0",
            }}
          >

            <strong>
              {anomalyDetected
                ? "⚠ Abnormal engine behaviour detected"
                : "✓ Engine behaviour is currently consistent"}
            </strong>

            <p
              style={{
                margin:
                  "6px 0 0",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              {anomalyMessage}
            </p>

            <p
              style={{
                margin:
                  "7px 0 0",
                color: "#64748b",
                fontSize: 12,
              }}
            >
              Samples analysed:{" "}
              {anomalySamples}
            </p>

          </div>

        </div>

        {/* ===================================================
            AI + ALERTS
            =================================================== */}

        <div className="bottom-grid">

          {/* PREDICTIVE INSIGHTS */}

          <div className="panel prediction-panel">

            <div className="panel-header">

              <div>

                <p className="panel-label">
                  AI ANALYTICS
                </p>

                <h3>
                  Predictive Insights
                </h3>

              </div>

              <BrainCircuit
                size={21}
              />

            </div>

            <div className="insight">

              <div className="insight-icon">

                <BarChart3
                  size={19}
                />

              </div>

              <div>

                <strong
                  style={{
                    color: dangerState
                      ? "#ff4d4d"
                      : undefined,
                  }}
                >

                  {hasFault
                    ? dashboardAlertTitle.replace(
                        "⚠ ",
                        ""
                      )
                    : "Engine operating normally"}

                </strong>

                <p>
                  {dashboardAlertMessage}
                </p>

              </div>

            </div>

            <div className="prediction-details">

              <div>

                <span>
                  Estimated RUL
                </span>

                <strong>

                  {rulMin !== undefined &&
                  rulMax !== undefined
                    ? `${rulMin}–${rulMax} hrs`
                    : "--"}

                </strong>

              </div>

              <div>

                <span>
                  Model Confidence
                </span>

                <strong>

                  {rulConfidence !== undefined
                    ? `${rulConfidence}%`
                    : "--"}

                </strong>

              </div>

              <div>

                <span>
                  Recommendation
                </span>

                <strong>

                  {activeRul
                    ?.recommendation ??
                    "Waiting for prediction..."}

                </strong>

              </div>

            </div>

          </div>

          {/* ALERTS */}

          <div
            className="panel alert-panel"
            style={{
              border: dangerState
                ? "1px solid rgba(255, 60, 60, 0.9)"
                : warningState
                ? "1px solid rgba(255, 170, 0, 0.8)"
                : undefined,

              boxShadow: dangerState
                ? "0 0 22px rgba(255, 30, 30, 0.25)"
                : warningState
                ? "0 0 15px rgba(255, 170, 0, 0.18)"
                : undefined,
            }}
          >

            <div className="panel-header">

              <div>

                <p className="panel-label">
                  SYSTEM EVENTS
                </p>

                <h3>
                  Latest Alert
                </h3>

              </div>

              <Bell
                size={20}
                style={{
                  color: dangerState
                    ? "#ff4d4d"
                    : warningState
                    ? "#f59e0b"
                    : undefined,
                }}
              />

            </div>

            <div className="alert-content">

              <span
                className={`alert-indicator ${
                  dangerState ||
                  warningState
                    ? "alert-warning"
                    : "alert-normal"
                }`}
                style={{
                  background:
                    dangerState
                      ? "#ff3b3b"
                      : warningState
                      ? "#f59e0b"
                      : "#22c55e",

                  boxShadow:
                    dangerState
                      ? "0 0 12px rgba(255, 40, 40, 0.8)"
                      : warningState
                      ? "0 0 10px rgba(245, 158, 11, 0.6)"
                      : "0 0 8px rgba(34, 197, 94, 0.5)",
                }}
              />

              <div>

                <strong
                  style={{
                    color: dangerState
                      ? "#ff4d4d"
                      : warningState
                      ? "#f59e0b"
                      : undefined,
                  }}
                >
                  {dashboardAlertTitle}
                </strong>

                <p>
                  {dashboardAlertMessage}
                </p>

              </div>

            </div>

            {activeFault
              ?.evidence &&
              activeFault.evidence
                .length > 0 && (

                <div className="fault-evidence">

                  <p>
                    Detection Evidence
                  </p>

                  {activeFault.evidence.map(
                    (
                      item,
                      index
                    ) => (

                      <div
                        key={index}
                        className="evidence-item"
                      >
                        • {item}
                      </div>

                    )
                  )}

                </div>

              )}

          </div>

        </div>

        {/* ===================================================
            ENGINE ANALYSIS FOOTER
            =================================================== */}

        <div className="analysis-footer">

          <div>

            <span>
              ENGINE CONDITION
            </span>

            <strong>
              {healthStatus}
            </strong>

          </div>

          <div>

            <span>
              FAULT SEVERITY
            </span>

            <strong
              style={{
                color: dangerState
                  ? "#ff4d4d"
                  : warningState
                  ? "#f59e0b"
                  : undefined,
              }}
            >
              {faultSeverity}
            </strong>

          </div>

          <div>

            <span>
              MISSION RISK
            </span>

            <strong
              style={{
                color: dangerState
                  ? "#ff4d4d"
                  : warningState
                  ? "#f59e0b"
                  : undefined,
              }}
            >
              {riskLevel}
            </strong>

          </div>

          <div>

            <span>
              MISSION DECISION
            </span>

            <strong>
              {missionDecision}
            </strong>

          </div>

        </div>

      </section>

      </main>
    </>
  );
}
