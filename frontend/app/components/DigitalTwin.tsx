"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

interface DigitalTwinProps {
  rpm: number;
  health: number;
  fault: string;
  severity?: string;
  egt?: number;
  cht?: number;
  oilPressure?: number;
  vibration?: number;
  riskScore?: number;
  riskLevel?: string;
}

function EngineModel({
  rpm,
  health,
  fault,
  severity,
  egt,
  cht,
  oilPressure,
  vibration,
}: DigitalTwinProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/aeropulse-engine.glb");

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.roughness = Math.min(material.roughness || 0.65, 0.8);
          material.metalness = Math.max(material.metalness || 0, 0.15);
        }
      });
    });

    return clone;
  }, [scene]);

  const normalizedRpm = THREE.MathUtils.clamp(rpm / 2500, 0.1, 1.2);
  const upperFault = fault.toUpperCase();
  const upperSeverity = (severity || "").toUpperCase();
  const isMisfire = upperFault.includes("MISFIRE");
  const isVibration = upperFault.includes("VIBRATION");
  const isOverheating =
    upperFault.includes("OVERHEAT") || (egt ?? 0) > 750 || (cht ?? 0) > 190;
  const isLowOil =
    upperFault.includes("LUBRICATION") || (oilPressure ?? 99) < 3;
  const isInjector = upperFault.includes("INJECTOR");

  const visualState =
    health < 70 || upperSeverity === "CRITICAL"
      ? "CRITICAL"
      : health < 85 || upperSeverity === "HIGH" || upperSeverity === "MEDIUM"
        ? "WARNING"
        : "NORMAL";

  const stateColor =
    visualState === "CRITICAL"
      ? "#ef4444"
      : visualState === "WARNING"
        ? "#f59e0b"
        : "#22c55e";

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime;
    groupRef.current.rotation.y += delta * (0.10 + normalizedRpm * 0.18);

    // Visual-only vibration effect. It does not change the engine data.
    if (isVibration || (vibration ?? 0) > 4) {
      const shake = 0.012 + Math.min((vibration ?? 4) / 100, 0.04);
      groupRef.current.position.x = Math.sin(time * 55) * shake;
      groupRef.current.position.z = Math.cos(time * 48) * shake;
    } else if (isMisfire) {
      // Intermittent movement represents unstable combustion.
      const pulse = Math.max(0, Math.sin(time * 12));
      groupRef.current.position.y = -0.35 + pulse * 0.025;
    } else {
      groupRef.current.position.x = 0;
      groupRef.current.position.z = 0;
      groupRef.current.position.y = -0.35;
    }
  });

  return (
    <group ref={groupRef} scale={1.15} position={[0, -0.35, 0]}>
      <primitive object={clonedScene} />

      {/* Main health halo */}
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.0, 2.08, 64]} />
        <meshBasicMaterial
          transparent
          opacity={visualState === "CRITICAL" ? 0.5 : visualState === "WARNING" ? 0.28 : 0.14}
          color={stateColor}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Overheating visual: warm pulsing ring */}
      {isOverheating && (
        <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.72, 0.045, 12, 64]} />
          <meshBasicMaterial color="#ff6b35" transparent opacity={0.75} />
        </mesh>
      )}

      {/* Low-oil visual: amber inner ring */}
      {isLowOil && (
        <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.48, 0.035, 12, 64]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Injector visual: small fuel-system marker */}
      {isInjector && (
        <mesh position={[0.95, 0.25, 0.95]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshBasicMaterial color="#60a5fa" />
        </mesh>
      )}
    </group>
  );
}

function Scene(props: DigitalTwinProps) {
  return (
    <Canvas
      camera={{ position: [4.8, 2.8, 5.8], fov: 38 }}
      dpr={[1, 1.75]}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={1.15} />
        <directionalLight position={[4, 6, 5]} intensity={2.4} castShadow />
        <directionalLight position={[-4, 2, -3]} intensity={1.0} />
        <pointLight position={[0, 2, 3]} intensity={0.8} />

        <EngineModel {...props} />

        <OrbitControls
          enablePan={false}
          minDistance={3.5}
          maxDistance={9}
          target={[0, 0, 0]}
        />
      </Suspense>
    </Canvas>
  );
}

function SensorLabel({ label, value, unit, top, left }: {
  label: string;
  value: string;
  unit?: string;
  top: string;
  left?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        right: left ? undefined : "10px",
        minWidth: 92,
        padding: "7px 9px",
        borderRadius: 9,
        background: "rgba(8, 13, 22, 0.82)",
        border: "1px solid rgba(148,163,184,0.22)",
        backdropFilter: "blur(8px)",
        color: "#e5e7eb",
        fontSize: 10,
        lineHeight: 1.2,
        pointerEvents: "none",
      }}
    >
      <div style={{ color: "#94a3b8", letterSpacing: "0.08em", fontSize: 8 }}>
        {label}
      </div>
      <strong style={{ fontSize: 13 }}>{value}</strong>{" "}
      {unit && <span style={{ color: "#94a3b8" }}>{unit}</span>}
    </div>
  );
}

export default function DigitalTwin({
  rpm,
  health,
  fault,
  severity,
  egt,
  cht,
  oilPressure,
  vibration,
  riskScore,
  riskLevel,
}: DigitalTwinProps) {
  const upperFault = fault.toUpperCase();
  const upperSeverity = (severity || "").toUpperCase();
  const state =
    health < 70 || upperSeverity === "CRITICAL"
      ? "CRITICAL"
      : health < 85 || ["HIGH", "MEDIUM"].includes(upperSeverity)
        ? "WARNING"
        : "NORMAL";

  const stateColor =
    state === "CRITICAL" ? "#ef4444" : state === "WARNING" ? "#f59e0b" : "#22c55e";

  const displayedFault = upperFault === "NO SIGNIFICANT FAULT" ? "SYSTEM NOMINAL" : fault;
  const risk = riskScore ?? 0;
  const riskColor =
    risk >= 75 ? "#ef4444" : risk >= 50 ? "#f59e0b" : "#22c55e";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 390,
        borderRadius: 14,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 45%, #26364a 0%, #101827 58%, #080d16 100%)",
      }}
    >
      <Scene
        rpm={rpm}
        health={health}
        fault={fault}
        severity={severity}
        egt={egt}
        cht={cht}
        oilPressure={oilPressure}
        vibration={vibration}
        riskScore={riskScore}
        riskLevel={riskLevel}
      />

      {/* Live twin state */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          padding: "7px 10px",
          borderRadius: 999,
          background: "rgba(8,13,22,.86)",
          border: `1px solid ${stateColor}66`,
          color: stateColor,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          pointerEvents: "none",
        }}
      >
        ● TWIN {state}
      </div>

      {/* Fault indication */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 12,
          maxWidth: 190,
          padding: "6px 9px",
          borderRadius: 8,
          background: "rgba(8,13,22,.76)",
          border: "1px solid rgba(148,163,184,.18)",
          color: stateColor,
          fontSize: 10,
          fontWeight: 700,
          pointerEvents: "none",
        }}
      >
        {displayedFault}
      </div>

      {/* Mission risk */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          minWidth: 120,
          padding: "8px 10px",
          borderRadius: 9,
          background: "rgba(8,13,22,.86)",
          border: `1px solid ${riskColor}55`,
          pointerEvents: "none",
        }}
      >
        <div style={{ color: "#94a3b8", fontSize: 8, letterSpacing: "0.08em" }}>
          MISSION RISK
        </div>
        <strong style={{ color: riskColor, fontSize: 14 }}>
          {riskScore !== undefined ? `${Math.round(riskScore)} / 100` : "--"}
        </strong>
        <span style={{ color: "#cbd5e1", fontSize: 9, marginLeft: 6 }}>
          {riskLevel || "WAITING"}
        </span>
      </div>

      {/* Sensor labels */}
      <SensorLabel label="RPM" value={rpm ? rpm.toFixed(0) : "--"} top="76px" left="12px" />
      <SensorLabel label="EGT" value={egt !== undefined ? egt.toFixed(1) : "--"} unit="°C" top="118px" left="12px" />
      <SensorLabel label="CHT" value={cht !== undefined ? cht.toFixed(1) : "--"} unit="°C" top="160px" left="12px" />
      <SensorLabel label="OIL PRESSURE" value={oilPressure !== undefined ? oilPressure.toFixed(2) : "--"} unit="bar" top="202px" left="12px" />
      <SensorLabel label="VIBRATION" value={vibration !== undefined ? vibration.toFixed(2) : "--"} unit="mm/s" top="244px" left="12px" />

      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "5px 9px",
          borderRadius: 999,
          background: "rgba(8,13,22,.72)",
          color: "#94a3b8",
          fontSize: 9,
          pointerEvents: "none",
        }}
      >
        Drag to rotate • Scroll to zoom • Visual twin only
      </div>
    </div>
  );
}

useGLTF.preload("/models/aeropulse-engine.glb");
