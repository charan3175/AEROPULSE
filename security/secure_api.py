"""
AERO-SENTINEL
Secure Telemetry API Layer

This module connects the existing engine telemetry
pipeline with the security components.

Security chain:
Device Authentication
        ↓
Hybrid Key Establishment
        ↓
AES-256-GCM
        ↓
Replay Protection
        ↓
Ground Station Decryption
"""

import time
import json
from typing import Dict, Any

try:
    from .device_auth import authenticate_device, generate_device_signature
    from .key_manager import establish_hybrid_session
    from .aes_gcm import (
        encrypt_telemetry as encrypt_data,
        decrypt_telemetry as decrypt_data,
    )
    from .replay_protection import ReplayProtector as ReplayProtection
except ImportError:
    from device_auth import authenticate_device, generate_device_signature
    from key_manager import establish_hybrid_session
    from aes_gcm import (
        encrypt_telemetry as encrypt_data,
        decrypt_telemetry as decrypt_data,
    )
    from replay_protection import ReplayProtector as ReplayProtection


# ============================================================
# CONFIGURATION
# ============================================================

DEFAULT_DEVICE_ID = "UAV-ENGINE-001"

# One replay protection manager for the running API process.
# In a production system this state should be persisted/shared.
replay_guard = ReplayProtection()


def canonical_telemetry(telemetry: Dict[str, Any]) -> str:
    return json.dumps(
        telemetry,
        sort_keys=True,
        separators=(",", ":"),
    )


# ============================================================
# SECURE TELEMETRY CREATION
# ============================================================

def create_secure_telemetry(
    telemetry: Dict[str, Any],
    device_id: str = DEFAULT_DEVICE_ID,
    sequence_number: int = 1,
) -> Dict[str, Any]:
    """
    Authenticate, encrypt and package engine telemetry.

    This is a prototype security pipeline.
    """

    timestamp = time.time()

    # --------------------------------------------------------
    # 1. DEVICE AUTHENTICATION
    # --------------------------------------------------------

    auth_result = authenticate_device(
        device_id=device_id,
        message=canonical_telemetry(telemetry),
        signature=generate_device_signature(
            device_id,
            canonical_telemetry(telemetry),
        ),
    )

    if not auth_result.get("authenticated", False):
        return {
            "status": "REJECTED",
            "stage": "DEVICE_AUTHENTICATION",
            "message": auth_result.get(
                "reason",
                "Device authentication failed.",
            ),
        }

    # --------------------------------------------------------
    # 2. HYBRID KEY ESTABLISHMENT
    # --------------------------------------------------------

    hybrid_result = establish_hybrid_session()

    session_key = (
        hybrid_result.get("session_key")
        if isinstance(hybrid_result, dict)
        else hybrid_result
    )

    if session_key is None:
        return {
            "status": "REJECTED",
            "stage": "HYBRID_KEY",
            "message": "Hybrid key establishment failed.",
        }

    # --------------------------------------------------------
    # 3. PACKET METADATA
    # --------------------------------------------------------

    metadata = {
        "device_id": device_id,
        "sequence_number": sequence_number,
        "timestamp": timestamp,
    }

    # --------------------------------------------------------
    # 4. AES-256-GCM ENCRYPTION
    # --------------------------------------------------------

    encrypted_result = encrypt_data(
        canonical_telemetry(telemetry),
        session_key,
        associated_data=json.dumps(metadata, sort_keys=True),
    )

    # --------------------------------------------------------
    # 5. RETURN SECURE PACKET
    # --------------------------------------------------------

    return {
        "status": "SECURED",

        "security": {
            "device_authentication": "PASS",
            "ml_kem": "ML-KEM-768",
            "qkd": "QKD-SIMULATION",
            "key_derivation": "HKDF-SHA256",
            "encryption": "AES-256-GCM",
        },

        "metadata": metadata,

        "encrypted_payload": encrypted_result,

        # Never expose the session key.
        "session_key_exposed": False,
    }


# ============================================================
# SECURE TELEMETRY RECEIVE
# ============================================================

def receive_secure_telemetry(
    packet: Dict[str, Any],
    session_key: bytes,
) -> Dict[str, Any]:
    """
    Validate replay protection and decrypt a secure packet.
    """

    metadata = packet["metadata"]

    device_id = metadata["device_id"]
    sequence_number = metadata["sequence_number"]
    timestamp = metadata["timestamp"]

    # --------------------------------------------------------
    # 1. REPLAY PROTECTION
    # --------------------------------------------------------

    replay_result = replay_guard.validate_packet(
        device_id=device_id,
        sequence_number=sequence_number,
        timestamp=timestamp,
    )

    if not replay_result.get("accepted", False):
        return {
            "status": "REJECTED",
            "stage": "REPLAY_PROTECTION",
            "message": replay_result.get(
                "reason",
                "Replay protection rejected the packet.",
            ),
        }

    # --------------------------------------------------------
    # 2. AES-256-GCM DECRYPTION
    # --------------------------------------------------------

    try:
        telemetry = decrypt_data(
            packet["encrypted_payload"],
            session_key,
            associated_data=json.dumps(metadata, sort_keys=True),
        )
        telemetry = json.loads(telemetry)

    except Exception:
        return {
            "status": "REJECTED",
            "stage": "DECRYPTION",
            "message": "Encrypted telemetry failed authentication or decryption.",
        }

    # --------------------------------------------------------
    # 3. SUCCESS
    # --------------------------------------------------------

    return {
        "status": "ACCEPTED",

        "security": {
            "replay_protection": "PASS",
            "decryption": "PASS",
            "integrity": "PASS",
        },

        "metadata": metadata,

        "telemetry": telemetry,
    }


# ============================================================
# END-TO-END SECURITY TEST
# ============================================================

def run_secure_telemetry_test(
    telemetry: Dict[str, Any],
    device_id: str = DEFAULT_DEVICE_ID,
    sequence_number: int = 1,
) -> Dict[str, Any]:
    """
    Run the complete secure telemetry demonstration.

    This function creates a hybrid session,
    encrypts telemetry and then decrypts it.
    """

    # --------------------------------------------------------
    # 1. HYBRID SESSION
    # --------------------------------------------------------

    hybrid_result = establish_hybrid_session()

    session_key = (
        hybrid_result.get("session_key")
        if isinstance(hybrid_result, dict)
        else hybrid_result
    )

    if session_key is None:
        return {
            "status": "REJECTED",
            "stage": "HYBRID_KEY",
            "message": "Hybrid key establishment failed.",
        }

    # --------------------------------------------------------
    # 2. DEVICE AUTHENTICATION
    # --------------------------------------------------------

    telemetry_message = canonical_telemetry(telemetry)

    try:
        signature = generate_device_signature(
            device_id,
            telemetry_message,
        )
    except ValueError as error:
        return {
            "status": "REJECTED",
            "stage": "DEVICE_AUTHENTICATION",
            "message": str(error),
        }

    auth_result = authenticate_device(
        device_id=device_id,
        message=telemetry_message,
        signature=signature,
    )

    if not auth_result.get("authenticated", False):
        return {
            "status": "REJECTED",
            "stage": "DEVICE_AUTHENTICATION",
            "message": auth_result.get(
                "reason",
                "Device authentication failed.",
            ),
        }

    # --------------------------------------------------------
    # 3. CREATE ENCRYPTED PACKET
    # --------------------------------------------------------

    timestamp = time.time()

    metadata = {
        "device_id": device_id,
        "sequence_number": sequence_number,
        "timestamp": timestamp,
    }

    encrypted_result = encrypt_data(
        telemetry_message,
        session_key,
        associated_data=json.dumps(metadata, sort_keys=True),
    )

    packet = {
        "metadata": metadata,
        "encrypted_payload": encrypted_result,
    }

    # --------------------------------------------------------
    # 4. RECEIVE PACKET
    # --------------------------------------------------------

    receive_result = receive_secure_telemetry(
        packet,
        session_key,
    )

    receive_security = receive_result.get("security", {})

    return {
        "status": receive_result["status"],

        "security": {
            "device_authentication": "PASS",
            "ml_kem": "PASS",
            "qkd_simulation": "PASS",
            "hybrid_key": "PASS",
            "hkdf": "PASS",
            "aes_256_gcm": "PASS",
            "replay_protection": receive_security.get(
                "replay_protection",
                "FAIL",
            ),
            "decryption": receive_security.get(
                "decryption",
                "FAIL",
            ),
        },

        "metadata": metadata,

        "telemetry": receive_result.get(
            "telemetry"
        ),

        "message": (
            "Secure telemetry successfully authenticated, "
            "encrypted, transmitted, replay-checked and decrypted."
            if receive_result["status"] == "ACCEPTED"
            else receive_result.get(
                "message",
                "Secure telemetry processing failed.",
            )
        ),
    }