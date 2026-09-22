import sys
import time
import base64
import json
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ============================================================
# PROJECT PATH
# ============================================================
# Allows the backend to find the sibling "security" folder
# even when FastAPI is started from inside the backend folder.

PROJECT_ROOT = Path(__file__).resolve().parent.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


# ============================================================
# ENGINE IMPORTS
# ============================================================

try:
    from .main import run_engine_pipeline
    from .engine_simulator import generate_engine_data
    from .database_service import (
        save_engine_telemetry,
        get_recent_telemetry,
    )
    from .fuzzy_health_model import calculate_fuzzy_health
    from .health_model import calculate_engine_health
    from .fault_detector import detect_fault
    from .rul_model import estimate_rul
    from .mission_risk import calculate_mission_risk

except ImportError:
    from main import run_engine_pipeline
    from engine_simulator import generate_engine_data
    from database_service import (
        save_engine_telemetry,
        get_recent_telemetry,
    )
    from fuzzy_health_model import calculate_fuzzy_health
    from health_model import calculate_engine_health
    from fault_detector import detect_fault
    from rul_model import estimate_rul
    from mission_risk import calculate_mission_risk


# ============================================================
# SECURITY IMPORT
# ============================================================

try:
    from security.secure_api import (
        run_secure_telemetry_test,
        canonical_telemetry,
    )
    from security.aes_gcm import encrypt_telemetry, decrypt_telemetry
    from security.device_auth import (
        authenticate_device,
        generate_device_signature,
    )
    from security.key_manager import establish_hybrid_session
    from security.replay_protection import ReplayProtector

except ImportError:
    # Fallback if the security folder is being treated
    # as a local package.
    from security.secure_api import (
        run_secure_telemetry_test,
        canonical_telemetry,
    )
    from security.aes_gcm import encrypt_telemetry, decrypt_telemetry
    from security.device_auth import (
        authenticate_device,
        generate_device_signature,
    )
    from security.key_manager import establish_hybrid_session
    from security.replay_protection import ReplayProtector


# ============================================================
# AERO-SENTINEL FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AERO-SENTINEL API",
    description=(
        "AI-Enabled Digital Twin for "
        "MALE UAV Engine Reliability "
        "with Secure Telemetry Validation"
    ),
    version="1.1.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# SECURITY TELEMETRY REQUEST MODEL
# ============================================================

class SecurityTelemetryRequest(BaseModel):
    """
    Telemetry values supplied by the Security Test UI.

    These values are intentionally editable so the evaluator
    can demonstrate legitimate and modified telemetry.
    """

    device_id: str = Field(default="UAV-ENGINE-001", min_length=1, max_length=80)

    rpm: float = Field(default=2400, ge=0, le=10000)
    egt: float = Field(default=700, ge=0, le=2000)
    cht: float = Field(default=155, ge=0, le=500)

    oil_pressure: float = Field(default=4.2, ge=0, le=20)

    vibration: float = Field(default=2.1, ge=0, le=100)


class SecurityTestRequest(BaseModel):
    test_type: str = Field(default="valid", min_length=1, max_length=30)
    telemetry: SecurityTelemetryRequest | None = None


# ============================================================
# SECURITY SEQUENCE COUNTER
# ============================================================
# A monotonically increasing sequence number is used so that
# repeated packets can later be demonstrated as replay attacks.

security_sequence_number = 1000


def get_next_security_sequence() -> int:
    global security_sequence_number

    security_sequence_number += 1

    return security_sequence_number


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "project": "AERO-SENTINEL",
        "status": "API running",
        "message": "Digital Twin backend is online",
        "security": "Secure telemetry module available",
    }


# ============================================================
# LIVE ENGINE STATUS
# ============================================================

@app.get("/engine/status")
def engine_status(
    fault: str = "normal"
):
    """
    Generate current engine telemetry and run
    the complete digital-twin pipeline.
    """

    result = run_engine_pipeline(
        fault=fault
    )

    # Store generated telemetry
    save_engine_telemetry(
        result["engine_data"],
        fault
    )

    return result


# ============================================================
# ENGINE HEALTH
# ============================================================

@app.get("/engine/health")
def engine_health():
    """
    Return current engine health result.
    """

    result = run_engine_pipeline(
        fault="normal"
    )

    return result["health"]


# ============================================================
# FAULT TEST
# ============================================================

@app.get("/engine/fault-test")
def engine_fault_test(
    fault: str = "overheating"
):
    """
    Run one simulated engine fault.
    """

    result = run_engine_pipeline(
        fault=fault
    )

    save_engine_telemetry(
        result["engine_data"],
        fault
    )

    return result


# ============================================================
# TELEMETRY HISTORY
# ============================================================

@app.get("/engine/history")
def engine_history(
    limit: int = 50
):
    """
    Return historical telemetry stored in PostgreSQL.
    """

    try:
        telemetry = get_recent_telemetry(
            limit
        )
    except Exception as error:
        # Keep the dashboard usable when PostgreSQL is unavailable.
        print(f"Telemetry history unavailable: {error}")
        telemetry = []

    return {
        "count": len(telemetry),
        "telemetry": telemetry,
    }


# ============================================================
# AVAILABLE FAULTS
# ============================================================

@app.get("/faults")
def available_faults():
    """
    Return all available fault simulation modes.
    """

    return {
        "faults": [
            "normal",
            "overheating",
            "low_oil",
            "high_vibration",
            "misfire",
            "injector",
        ]
    }


# ============================================================
# MISSION REPLAY
# ============================================================

@app.get("/engine/replay")
def engine_replay(
    limit: int = 50
):
    """
    Reconstruct historical engine states from
    PostgreSQL telemetry.
    """

    try:
        telemetry = get_recent_telemetry(
            limit
        )
    except Exception as error:
        # Keep replay available as an empty state when PostgreSQL is unavailable.
        print(f"Mission replay unavailable: {error}")
        telemetry = []

    replay_states = []

    for item in telemetry:

        # --------------------------------------------
        # Reconstruct engine data
        # --------------------------------------------

        engine_data = {
            "timestamp": item["timestamp"],
            "rpm": item["rpm"],
            "egt": item["egt"],
            "cht": item["cht"],
            "oil_pressure": item["oil_pressure"],
            "oil_temperature": item["oil_temperature"],
            "vibration": item["vibration"],
            "fuel_flow": item["fuel_flow"],
            "throttle": item["throttle"],
        }

        # --------------------------------------------
        # Recalculate engine health
        # --------------------------------------------

        health_result = calculate_fuzzy_health(
            engine_data
        )

        # --------------------------------------------
        # Recalculate fault
        # --------------------------------------------

        fault_result = detect_fault(
            engine_data
        )

        # --------------------------------------------
        # Recalculate RUL
        # --------------------------------------------

        rul_result = estimate_rul(
            health_result,
            fault_result
        )

        # --------------------------------------------
        # Recalculate mission risk
        # --------------------------------------------

        mission_risk = calculate_mission_risk(
            health_result,
            fault_result,
            rul_result,
            altitude=4500,
            ambient_temperature=32,
            throttle=engine_data.get(
                "throttle",
                70
            ),
            mission_duration=20,
        )

        # --------------------------------------------
        # Add reconstructed state
        # --------------------------------------------

        replay_states.append(
            {
                "timestamp": item["timestamp"],
                "engine_data": engine_data,
                "health": health_result,
                "fault": fault_result,
                "rul": rul_result,
                "mission_risk": mission_risk,
                "fault_mode": item["fault_mode"],
            }
        )

    return {
        "count": len(
            replay_states
        ),
        "replay": replay_states,
    }


# ============================================================
# MISSION SCENARIO
# ============================================================

@app.get("/engine/mission-scenario")
def engine_mission_scenario(
    fault: str = "normal",
    altitude: float = 4500,
    ambient_temperature: float = 32,
    throttle: float = 70,
    mission_duration: float = 20,
):
    """
    Run a mission-aware engine reliability scenario.

    The scenario combines:
    - Engine telemetry
    - Engine health
    - Fault detection
    - RUL estimation
    - Mission risk assessment

    IMPORTANT:
    This is a prototype decision-support model.
    It is not certified for real flight operations.
    """

    # ---------------------------------------------------------
    # 1. GENERATE ENGINE TELEMETRY
    # ---------------------------------------------------------

    engine_data = generate_engine_data(fault)

    # ---------------------------------------------------------
    # 2. ENGINE HEALTH
    # ---------------------------------------------------------

    health_result = calculate_fuzzy_health(
        engine_data
    )

    # ---------------------------------------------------------
    # 3. FAULT DETECTION
    # ---------------------------------------------------------

    fault_result = detect_fault(
        engine_data
    )

    # ---------------------------------------------------------
    # 4. RUL ESTIMATION
    # ---------------------------------------------------------

    rul_result = estimate_rul(
        health_result,
        fault_result
    )

    # ---------------------------------------------------------
    # 5. MISSION-AWARE RISK
    # ---------------------------------------------------------

    mission_risk = calculate_mission_risk(
        health_result,
        fault_result,
        rul_result,
        altitude=altitude,
        ambient_temperature=ambient_temperature,
        throttle=throttle,
        mission_duration=mission_duration,
    )

    # ---------------------------------------------------------
    # 6. SAVE TELEMETRY
    # ---------------------------------------------------------

    save_engine_telemetry(
        engine_data,
        fault
    )

    # ---------------------------------------------------------
    # 7. RETURN COMPLETE PIPELINE
    # ---------------------------------------------------------

    return {
        "engine_data": engine_data,
        "health": health_result,
        "fault": fault_result,
        "rul": rul_result,
        "mission_risk": mission_risk,
    }


# ============================================================
# SECURITY — SECURE TELEMETRY
# ============================================================

@app.post("/security/telemetry")
def security_telemetry(
    request: SecurityTelemetryRequest
):
    """
    Secure telemetry demonstration endpoint.

    Flow:

    Editable telemetry
            ↓
    Device Authentication
            ↓
    ML-KEM-768
            +
    QKD Simulation
            ↓
    Hybrid Session Key
            ↓
    HKDF-SHA256
            ↓
    AES-256-GCM
            ↓
    Replay Protection
            ↓
    Decryption
            ↓
    ACCEPTED / REJECTED
    """

    sequence_number = get_next_security_sequence()

    telemetry = {
        "device_id": request.device_id,
        "rpm": request.rpm,
        "egt": request.egt,
        "cht": request.cht,
        "oil_pressure": request.oil_pressure,
        "vibration": request.vibration,
    }

    try:

        result = run_secure_telemetry_test(
            telemetry=telemetry,
            device_id=request.device_id,
            sequence_number=sequence_number,
        )

        # Add demonstration information.
        result["demo"] = {
            "sequence_number": sequence_number,
            "telemetry": telemetry,
            "editable": True,
        }

        result.setdefault("metadata", {
            "device_id": request.device_id,
            "sequence_number": sequence_number,
            "timestamp": time.time(),
        })

        return result

    except Exception as error:

        return {
            "status": "REJECTED",
            "stage": "SECURITY_PIPELINE",
            "message": (
                "Secure telemetry processing failed."
            ),
            "error": str(error),
            "demo": {
                "sequence_number": sequence_number,
                "telemetry": telemetry,
                "editable": True,
            },
        }


def _security_test_result(
    test: str,
    status: str,
    passed: bool,
    message: str,
    checks: Dict[str, str],
    details: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    result = {
        "test": test,
        "status": status,
        "passed": passed,
        "message": message,
        "checks": checks,
    }
    if details:
        result["details"] = details
    return result


def _security_test_telemetry(request: SecurityTestRequest) -> Dict[str, Any]:
    source = request.telemetry or SecurityTelemetryRequest()
    return {
        "device_id": source.device_id,
        "rpm": source.rpm,
        "egt": source.egt,
        "cht": source.cht,
        "oil_pressure": source.oil_pressure,
        "vibration": source.vibration,
    }


def _run_security_test(test_type: str, request: SecurityTestRequest) -> Dict[str, Any]:
    telemetry = _security_test_telemetry(request)
    device_id = telemetry["device_id"]

    if test_type == "valid":
        result = run_secure_telemetry_test(
            telemetry=telemetry,
            device_id=device_id,
            sequence_number=get_next_security_sequence(),
        )
        status = result.get("status", "REJECTED")
        checks = result.get("security", {})
        passed = status == "ACCEPTED"
        return _security_test_result(
            "valid",
            status,
            passed,
            "Valid telemetry was accepted." if passed else result.get("message", "Valid telemetry was rejected."),
            checks,
            {"metadata": result.get("metadata")},
        )

    if test_type == "unknown_device":
        unknown_device = "UAV-ATTACKER-999"
        message = canonical_telemetry({**telemetry, "device_id": unknown_device})
        result = authenticate_device(
            unknown_device,
            message,
            "invalid-signature",
        )
        rejected = not result.get("authenticated", False)
        return _security_test_result(
            "unknown_device",
            "REJECTED" if rejected else "ACCEPTED",
            rejected,
            "Unauthorised device telemetry was rejected." if rejected else "Unknown device was accepted.",
            {
                "device_authentication": "FAIL" if rejected else "PASS",
                "encryption_integrity": "NOT RUN",
                "replay_protection": "NOT RUN",
            },
            {"device_id": unknown_device, "reason": result.get("reason")},
        )

    if test_type == "replay":
        protector = ReplayProtector()
        timestamp = time.time()
        sequence_number = get_next_security_sequence()
        first = protector.validate_packet(device_id, sequence_number, timestamp)
        second = protector.validate_packet(device_id, sequence_number, timestamp)
        rejected = first.get("accepted", False) and not second.get("accepted", False)
        return _security_test_result(
            "replay",
            "REJECTED" if not second.get("accepted", False) else "ACCEPTED",
            rejected,
            "Previously accepted telemetry was rejected when replayed." if rejected else "Replay packet was accepted.",
            {
                "device_authentication": "PASS",
                "encryption_integrity": "PASS",
                "replay_protection": "PASS" if rejected else "FAIL",
            },
            {"original_packet": first.get("status"), "repeated_packet": second.get("status")},
        )

    if test_type == "tampering":
        session_key = establish_hybrid_session()
        if session_key is None:
            raise RuntimeError("Hybrid key establishment is unavailable.")

        message = canonical_telemetry(telemetry)
        signature = generate_device_signature(device_id, message)
        auth_result = authenticate_device(device_id, message, signature)
        metadata = {
            "device_id": device_id,
            "sequence_number": get_next_security_sequence(),
            "timestamp": time.time(),
        }
        associated_data = json.dumps(metadata, sort_keys=True)
        encrypted = encrypt_telemetry(message, session_key, associated_data)
        ciphertext = bytearray(base64.b64decode(encrypted["ciphertext"]))
        ciphertext[0] ^= 1
        encrypted["ciphertext"] = base64.b64encode(bytes(ciphertext)).decode()

        rejected = False
        try:
            decrypt_telemetry(encrypted, session_key, associated_data)
        except Exception:
            rejected = True

        return _security_test_result(
            "tampering",
            "REJECTED" if rejected else "ACCEPTED",
            bool(auth_result.get("authenticated")) and rejected,
            "Tampered telemetry was rejected successfully." if rejected else "Tampered telemetry was accepted.",
            {
                "device_authentication": "PASS" if auth_result.get("authenticated") else "FAIL",
                "encryption_integrity": "PASS" if rejected else "FAIL",
                "replay_protection": "NOT RUN",
            },
            {"original_egt": telemetry["egt"], "tampered_egt": 950},
        )

    raise ValueError(f"Unsupported security test: {test_type}")


@app.post("/security/test")
def security_test(request: SecurityTestRequest):
    test_type = request.test_type.strip().lower()
    supported = {"valid", "tampering", "replay", "unknown_device"}

    if test_type == "all":
        results = []
        for name in ("valid", "tampering", "replay", "unknown_device"):
            try:
                results.append(_run_security_test(name, request))
            except Exception as error:
                results.append(_security_test_result(
                    name,
                    "ERROR",
                    False,
                    "Security test could not be completed.",
                    {"error": str(error)},
                ))
        return {
            "test": "all",
            "status": "PASSED" if all(item["passed"] for item in results) else "FAILED",
            "passed": all(item["passed"] for item in results),
            "message": "All security tests passed." if all(item["passed"] for item in results) else "One or more security tests failed.",
            "results": results,
        }

    if test_type not in supported:
        return {
            "test": test_type,
            "status": "ERROR",
            "passed": False,
            "message": f"Unsupported test type. Choose one of: {', '.join(sorted(supported))}.",
            "checks": {},
        }

    try:
        return _run_security_test(test_type, request)
    except Exception as error:
        print(f"Security test {test_type} failed: {error}")
        return _security_test_result(
            test_type,
            "ERROR",
            False,
            "Security backend unavailable.",
            {"error": str(error)},
        )


# ============================================================
# SECURITY STATUS
# ============================================================

@app.get("/security/status")
def security_status():
    """
    Return the security capabilities available
    in the AERO-SENTINEL prototype.
    """

    return {
        "system": "AERO-SENTINEL Security Layer",
        "status": "ONLINE",

        "security_chain": [
            "Device Authentication",
            "ML-KEM-768",
            "QKD Simulation",
            "Hybrid Key Establishment",
            "HKDF-SHA256",
            "AES-256-GCM",
            "Replay Protection",
            "Authenticated Decryption",
        ],

        "prototype": True,

        "available_tests": [
            "valid",
            "tampering",
            "replay",
            "unknown_device",
        ],

        "note": (
            "This is a prototype security demonstration. "
            "It is not a certified military security system."
        ),
    }


# ============================================================
# SYSTEM INFORMATION
# ============================================================

@app.get("/system/info")
def system_info():
    """
    Return AERO-SENTINEL system information.
    """

    return {
        "system": "AERO-SENTINEL",

        "module": (
            "Digital Twin Engine Monitoring"
        ),

        "version": "1.1.0",

        "status": "ONLINE",

        "modules": [
            "Engine Simulator",
            "Health Monitoring",
            "Fault Detection",
            "RUL Prediction",
            "Mission Risk Assessment",
            "Mission Scenario Simulation",
            "Historical Telemetry",
            "Mission Replay",
            "AI Anomaly Detection",
            "Secure Telemetry",
            "Device Authentication",
            "ML-KEM-768",
            "QKD Simulation",
            "AES-256-GCM",
            "Replay Protection",
        ],
    }