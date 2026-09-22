"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";

type EngineProps = {
  rpm: number;
  health: number;
  fault: string;
};

/* -------------------------------------------------------
   MATERIALS
------------------------------------------------------- */

const metal = new THREE.MeshStandardMaterial({
  color: "#8b949e",
  metalness: 0.85,
  roughness: 0.28,
});

const darkMetal = new THREE.MeshStandardMaterial({
  color: "#252b32",
  metalness: 0.9,
  roughness: 0.22,
});

const silver = new THREE.MeshStandardMaterial({
  color: "#c7cdd3",
  metalness: 0.9,
  roughness: 0.2,
});

const black = new THREE.MeshStandardMaterial({
  color: "#10151b",
  metalness: 0.7,
  roughness: 0.3,
});

const copper = new THREE.MeshStandardMaterial({
  color: "#b87333",
  metalness: 0.85,
  roughness: 0.25,
});

const blue = new THREE.MeshStandardMaterial({
  color: "#1266a8",
  metalness: 0.8,
  roughness: 0.22,
});

const gold = new THREE.MeshStandardMaterial({
  color: "#c69214",
  metalness: 0.85,
  roughness: 0.22,
});

const pistonMaterial = new THREE.MeshStandardMaterial({
  color: "#d8dde2",
  metalness: 0.95,
  roughness: 0.15,
});

const rodMaterial = new THREE.MeshStandardMaterial({
  color: "#65a96b",
  metalness: 0.8,
  roughness: 0.25,
});

/* -------------------------------------------------------
   SMALL HELPERS
------------------------------------------------------- */

function Bolt({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.07, 0.07, 0.12, 12]} />
      <meshStandardMaterial
        color="#d8dce0"
        metalness={0.95}
        roughness={0.18}
      />
    </mesh>
  );
}

function CylinderFins() {
  return (
    <group>
      {[-0.48, -0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36, 0.48].map(
        (y, i) => (
          <mesh key={i} position={[0, y, 0]}>
            <cylinderGeometry args={[0.58, 0.62, 0.045, 32]} />
            <meshStandardMaterial
              color="#30363d"
              metalness={0.8}
              roughness={0.35}
            />
          </mesh>
        )
      )}
    </group>
  );
}

/* -------------------------------------------------------
   CYLINDER
------------------------------------------------------- */

function Cylinder({
  x,
  pistonY,
  phase,
}: {
  x: number;
  pistonY: number;
  phase: number;
}) {
  return (
    <group position={[x, 0, 0]}>
      {/* Cylinder body */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.52, 0.56, 1.05, 32]} />
        <primitive object={darkMetal} attach="material" />
      </mesh>

      {/* Cooling fins */}
      <CylinderFins />

      {/* Cylinder head */}
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.58, 0.53, 0.28, 32]} />
        <primitive object={silver} attach="material" />
      </mesh>

      {/* Rocker cover */}
      <mesh position={[0, 1.30, 0]}>
        <boxGeometry args={[0.82, 0.25, 0.65]} />
        <primitive object={black} attach="material" />
      </mesh>

      {/* Rocker cover center */}
      <mesh position={[0, 1.45, 0]}>
        <boxGeometry args={[0.55, 0.08, 0.40]} />
        <primitive object={silver} attach="material" />
      </mesh>

      {/* Spark plug */}
      <mesh position={[0.27, 1.48, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.22, 12]} />
        <primitive object={copper} attach="material" />
      </mesh>

      {/* Piston */}
      <mesh position={[0, pistonY, 0]}>
        <cylinderGeometry args={[0.39, 0.39, 0.34, 32]} />
        <primitive object={pistonMaterial} attach="material" />
      </mesh>

      {/* Piston rings */}
      {[-0.11, 0, 0.11].map((yy, i) => (
        <mesh key={i} position={[0, pistonY + yy, 0]}>
          <torusGeometry args={[0.395, 0.018, 8, 32]} />
          <primitive object={darkMetal} attach="material" />
        </mesh>
      ))}

      {/* Combustion glow */}
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.04, 24]} />
        <meshStandardMaterial
          color="#ff6b1a"
          emissive="#ff3500"
          emissiveIntensity={1.2}
        />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------
   CONNECTING ROD
------------------------------------------------------- */

function ConnectingRod({
  x,
  pistonY,
  crankY,
  crankZ,
}: {
  x: number;
  pistonY: number;
  crankY: number;
  crankZ: number;
}) {
  const top = new THREE.Vector3(x, pistonY - 0.14, 0);
  const bottom = new THREE.Vector3(x, crankY, crankZ);

  const direction = new THREE.Vector3().subVectors(bottom, top);
  const length = direction.length();

  const middle = new THREE.Vector3()
    .addVectors(top, bottom)
    .multiplyScalar(0.5);

  const quaternion = new THREE.Quaternion();

  quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );

  return (
    <group position={middle} quaternion={quaternion}>
      {/* Main rod */}
      <mesh>
        <boxGeometry args={[0.14, length, 0.13]} />
        <primitive object={rodMaterial} attach="material" />
      </mesh>

      {/* Upper bearing */}
      <mesh position={[0, length / 2, 0]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <primitive object={rodMaterial} attach="material" />
      </mesh>

      {/* Lower bearing */}
      <mesh position={[0, -length / 2, 0]}>
        <sphereGeometry args={[0.17, 16, 16]} />
        <primitive object={rodMaterial} attach="material" />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------
   CRANKSHAFT
------------------------------------------------------- */

function Crankshaft({
  rpm,
  pistonPositions,
}: {
  rpm: number;
  pistonPositions: number[];
}) {
  const crankRef = useRef<THREE.Group>(null);

  const angleRef = useRef(0);

  useFrame((_, delta) => {
    const speed = Math.max(rpm, 300) / 60;

    angleRef.current += delta * speed * Math.PI * 2;

    if (crankRef.current) {
      crankRef.current.rotation.x = angleRef.current;
    }
  });

  return (
    <group ref={crankRef} rotation={[Math.PI / 2, 0, 0]}>
      {/* Main crankshaft */}
      <mesh>
        <cylinderGeometry args={[0.13, 0.13, 4.8, 24]} />
        <primitive object={darkMetal} attach="material" />
      </mesh>

      {/* Crank webs */}
      {[-1.8, -0.6, 0.6, 1.8].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.18, 24]} />
            <primitive object={copper} attach="material" />
          </mesh>

          <mesh position={[0, 0.25, 0.25]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <primitive object={silver} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Crankshaft end */}
      <mesh position={[2.55, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.35, 24]} />
        <primitive object={silver} attach="material" />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------
   PROPELLER
------------------------------------------------------- */

function Propeller({ rpm }: { rpm: number }) {
  const propellerRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (propellerRef.current) {
      propellerRef.current.rotation.x +=
        delta * Math.max(rpm, 300) * 0.055;
    }
  });

  return (
    <group ref={propellerRef} position={[-3.15, 0, 0]}>
      {/* Propeller hub */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.48, 0.58, 0.7, 32]} />
        <primitive object={silver} attach="material" />
      </mesh>

      {/* Nose cone */}
      <mesh position={[-0.45, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <coneGeometry args={[0.5, 1.1, 32]} />
        <primitive object={silver} attach="material" />
      </mesh>

      {/* Four blades */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((rotation, i) => (
        <group key={i} rotation={[rotation, 0, 0]}>
          <mesh position={[-0.08, 1.25, 0]}>
            <boxGeometry args={[0.18, 2.1, 0.12]} />
            <meshStandardMaterial
              color="#161b22"
              metalness={0.55}
              roughness={0.3}
            />
          </mesh>

          {/* Blade tip */}
          <mesh position={[-0.08, 2.25, 0]}>
            <boxGeometry args={[0.2, 0.25, 0.14]} />
            <primitive object={gold} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------------
   GEARBOX
------------------------------------------------------- */

function Gearbox({ rpm }: { rpm: number }) {
  const gearRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (gearRef.current) {
      gearRef.current.rotation.x += delta * Math.max(rpm, 300) * 0.035;
    }
  });

  return (
    <group position={[-2.35, 0, 0]}>
      {/* Housing */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[1.0, 1.0, 0.55, 32]} />
        <primitive object={blue} attach="material" />
      </mesh>

      {/* Gear */}
      <group ref={gearRef}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.48, 0.10, 12, 32]} />
          <primitive object={silver} attach="material" />
        </mesh>

        {Array.from({ length: 10 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              0,
              Math.cos((i / 10) * Math.PI * 2) * 0.48,
              Math.sin((i / 10) * Math.PI * 2) * 0.48,
            ]}
            rotation={[0, 0, (i / 10) * Math.PI * 2]}
          >
            <boxGeometry args={[0.12, 0.18, 0.12]} />
            <primitive object={silver} attach="material" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* -------------------------------------------------------
   EXHAUST MANIFOLD
------------------------------------------------------- */

function ExhaustSystem() {
  const pipes = [-1.8, -0.6, 0.6, 1.8];

  return (
    <group position={[0, 0.7, -0.8]}>
      {pipes.map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0, 0]}>
            <torusGeometry args={[0.35, 0.07, 10, 24, Math.PI]} />
            <primitive object={darkMetal} attach="material" />
          </mesh>

          <mesh position={[x, -0.28, -0.2]}>
            <cylinderGeometry args={[0.09, 0.11, 0.7, 16]} />
            <primitive object={darkMetal} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Main manifold */}
      <mesh position={[0, -0.3, -0.25]}>
        <cylinderGeometry args={[0.13, 0.16, 4.5, 20]} />
        <primitive object={darkMetal} attach="material" />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------
   OIL SYSTEM
------------------------------------------------------- */

function OilSystem() {
  return (
    <group position={[0, -1.15, 0]}>
      {/* Oil sump */}
      <mesh>
        <boxGeometry args={[4.5, 0.45, 1.0]} />
        <primitive object={black} attach="material" />
      </mesh>

      {/* Oil filter */}
      <mesh position={[1.2, -0.35, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.5, 24]} />
        <primitive object={gold} attach="material" />
      </mesh>

      {/* Oil pipe */}
      <mesh position={[1.55, -0.1, 0]}>
        <torusGeometry args={[0.35, 0.055, 10, 24, Math.PI]} />
        <primitive object={copper} attach="material" />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------
   MAIN ENGINE
------------------------------------------------------- */

export default function RealisticEngine({
  rpm,
  health,
  fault,
}: EngineProps) {
  const engineRef = useRef<THREE.Group>(null);

  const [crankAngle, setCrankAngle] = useState(0);

  useFrame((_, delta) => {
    setCrankAngle(
      (angle) => angle + delta * Math.max(rpm, 300) * 0.025
    );
  });

  /*
    Four-cylinder piston positions.

    Different phases make the four pistons
    move at different times.
  */

  const phases = [0, Math.PI, 0, Math.PI];

  const pistonPositions = phases.map((phase) => {
    return 0.48 + Math.sin(crankAngle + phase) * 0.32;
  });

  /*
    Crank pin positions.
  */

  const crankPositions = phases.map((phase) => {
    const a = crankAngle + phase;

    return {
      y: -0.45 + Math.sin(a) * 0.28,
      z: Math.cos(a) * 0.28,
    };
  });

  /*
    Fault visualisation.

    When fault exists, engine becomes slightly orange/red.
  */

  const hasFault =
    fault &&
    fault !== "NO SIGNIFICANT FAULT" &&
    fault !== "Normal";

  const faultColor = hasFault ? "#ff4d2e" : "#65ffb0";

  return (
    <group ref={engineRef} rotation={[0, 0, 0]}>
      {/* -----------------------------------------------
          MAIN CRANKCASE
      ------------------------------------------------ */}

      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[5.2, 1.55, 1.45]} />
        <primitive object={darkMetal} attach="material" />
      </mesh>

      {/* Front crankcase plate */}
      <mesh position={[-2.65, -0.25, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.22, 32]} />
        <primitive object={silver} attach="material" />
      </mesh>

      {/* Rear housing */}
      <mesh position={[2.65, -0.25, 0]}>
        <boxGeometry args={[0.55, 1.7, 1.6]} />
        <primitive object={metal} attach="material" />
      </mesh>

      {/* -----------------------------------------------
          FOUR CYLINDERS
      ------------------------------------------------ */}

      {[-1.8, -0.6, 0.6, 1.8].map((x, i) => (
        <Cylinder
          key={i}
          x={x}
          pistonY={pistonPositions[i]}
          phase={phases[i]}
        />
      ))}

      {/* -----------------------------------------------
          CONNECTING RODS
      ------------------------------------------------ */}

      {[-1.8, -0.6, 0.6, 1.8].map((x, i) => (
        <ConnectingRod
          key={i}
          x={x}
          pistonY={pistonPositions[i]}
          crankY={crankPositions[i].y}
          crankZ={crankPositions[i].z}
        />
      ))}

      {/* -----------------------------------------------
          CRANKSHAFT
      ------------------------------------------------ */}

      <Crankshaft
        rpm={rpm}
        pistonPositions={pistonPositions}
      />

      {/* -----------------------------------------------
          GEARBOX
      ------------------------------------------------ */}

      <Gearbox rpm={rpm} />

      {/* -----------------------------------------------
          PROPELLER
      ------------------------------------------------ */}

      <Propeller rpm={rpm} />

      {/* -----------------------------------------------
          EXHAUST
      ------------------------------------------------ */}

      <ExhaustSystem />

      {/* -----------------------------------------------
          OIL SYSTEM
      ------------------------------------------------ */}

      <OilSystem />

      {/* -----------------------------------------------
          ENGINE BOLTS
      ------------------------------------------------ */}

      <Bolt position={[-2.1, -0.95, 0.7]} />
      <Bolt position={[-0.7, -0.95, 0.7]} />
      <Bolt position={[0.7, -0.95, 0.7]} />
      <Bolt position={[2.1, -0.95, 0.7]} />

      {/* -----------------------------------------------
          HEALTH INDICATOR
      ------------------------------------------------ */}

      <mesh position={[0, -1.55, 0]}>
        <boxGeometry args={[4.4, 0.05, 0.05]} />
        <meshStandardMaterial
          color={faultColor}
          emissive={faultColor}
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* -----------------------------------------------
          SMALL STATUS LIGHTS
      ------------------------------------------------ */}

      {[-1.5, -0.5, 0.5, 1.5].map((x, i) => (
        <mesh key={i} position={[x, 1.58, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial
            color={faultColor}
            emissive={faultColor}
            emissiveIntensity={2}
          />
        </mesh>
      ))}
    </group>
  );
}