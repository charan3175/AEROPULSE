"""
AERO-SENTINEL Hybrid Secure Telemetry

Security flow:

Device Authentication
        ↓
ML-KEM-768
        +
QKD Simulation
        ↓
Hybrid Key Manager
        ↓
HKDF-SHA256
        ↓
AES-256-GCM
        ↓
Replay Protection
        ↓
Ground Station Decryption

IMPORTANT:
QKD is simulated and does not represent real quantum communication.
This is a research/prototype implementation.
"""

import json
import time

from device_auth import (
    generate_device_signature,
    authenticate_device,
)

from aes_gcm import (
    encrypt_telemetry,
    decrypt_telemetry,
)

from replay_protection import ReplayProtector

from key_manager import establish_hybrid_session


DEVICE_ID = "UAV-ENGINE-001"


def create_telemetry():

    return {
        "device_id": DEVICE_ID,
        "rpm": 2400,
        "egt": 700,
        "cht": 155,
        "oil_pressure": 4.2,
        "oil_temperature": 96,
        "vibration": 2.1,
        "fuel_flow": 20.4,
        "throttle": 72,
    }


def canonical_telemetry(telemetry):

    return json.dumps(
        telemetry,
        sort_keys=True,
        separators=(",", ":"),
    )


def run_hybrid_secure_pipeline():

    print("\n")
    print("=" * 65)
    print("AERO-SENTINEL HYBRID SECURE TELEMETRY")
    print("=" * 65)

    # -------------------------------------------------
    # 1. ENGINE TELEMETRY
    # -------------------------------------------------

    telemetry = create_telemetry()

    telemetry_message = canonical_telemetry(
        telemetry
    )

    print("\n[1] ENGINE TELEMETRY")
    print("--------------------")
    print(telemetry_message)

    # -------------------------------------------------
    # 2. DEVICE AUTHENTICATION
    # -------------------------------------------------

    print("\n[2] DEVICE AUTHENTICATION")
    print("-------------------------")

    signature = generate_device_signature(
        DEVICE_ID,
        telemetry_message,
    )

    auth_result = authenticate_device(
        DEVICE_ID,
        telemetry_message,
        signature,
    )

    print(
        "Device ID:",
        DEVICE_ID
    )

    print(
        "Authentication:",
        auth_result["status"]
    )

    if not auth_result["authenticated"]:

        print(
            "ERROR: Device authentication failed."
        )

        return

    # -------------------------------------------------
    # 3. HYBRID KEY ESTABLISHMENT
    # -------------------------------------------------

    print("\n[3] HYBRID KEY ESTABLISHMENT")
    print("----------------------------")

    session_key = establish_hybrid_session()

    if session_key is None:

        print(
            "ERROR: Hybrid key establishment failed."
        )

        return

    # -------------------------------------------------
    # 4. PACKET METADATA
    # -------------------------------------------------

    print("\n[4] PACKET METADATA")
    print("-------------------")

    sequence_number = 1001
    timestamp = time.time()

    associated_data = (
        f"{DEVICE_ID}|"
        f"sequence={sequence_number}|"
        f"timestamp={timestamp}"
    )

    print(
        "Sequence number:",
        sequence_number
    )

    print(
        "Timestamp:",
        timestamp
    )

    # -------------------------------------------------
    # 5. AES-256-GCM ENCRYPTION
    # -------------------------------------------------

    print("\n[5] AES-256-GCM ENCRYPTION")
    print("--------------------------")

    encrypted = encrypt_telemetry(
        telemetry_message,
        session_key,
        associated_data,
    )

    print(
        "Telemetry encrypted."
    )

    print(
        "Nonce generated."
    )

    print(
        "Authentication tag generated."
    )

    # -------------------------------------------------
    # 6. REPLAY PROTECTION
    # -------------------------------------------------

    print("\n[6] REPLAY PROTECTION")
    print("---------------------")

    replay_protector = ReplayProtector(
        max_clock_skew_seconds=30
    )

    replay_result = replay_protector.validate_packet(
        device_id=DEVICE_ID,
        sequence_number=sequence_number,
        timestamp=timestamp,
    )

    print(
        "Replay status:",
        replay_result["status"]
    )

    print(
        "Reason:",
        replay_result["reason"]
    )

    if not replay_result["accepted"]:

        print(
            "ERROR: Packet rejected."
        )

        return

    # -------------------------------------------------
    # 7. GROUND STATION DECRYPTION
    # -------------------------------------------------

    print("\n[7] GROUND STATION DECRYPTION")
    print("-----------------------------")

    decrypted_message = decrypt_telemetry(
        encrypted,
        session_key,
        associated_data,
    )

    print(
        "Telemetry decrypted successfully."
    )

    # -------------------------------------------------
    # 8. FINAL VERIFICATION
    # -------------------------------------------------

    print("\n[8] FINAL TELEMETRY VERIFICATION")
    print("---------------------------------")

    if decrypted_message == telemetry_message:

        print(
            "SUCCESS: Original telemetry recovered."
        )

    else:

        print(
            "ERROR: Telemetry mismatch."
        )

        return

    print("\n")
    print("=" * 65)
    print("HYBRID SECURE TELEMETRY TEST SUCCESSFUL")
    print("=" * 65)

    print("\nSecurity chain:")

    print("1. Device Authentication       : PASS")
    print("2. ML-KEM-768                  : PASS")
    print("3. QKD Simulation              : PASS")
    print("4. Hybrid Key Manager          : PASS")
    print("5. HKDF-SHA256                 : PASS")
    print("6. AES-256-GCM                 : PASS")
    print("7. Replay Protection           : PASS")
    print("8. Ground Station Decryption   : PASS")
    print("9. Telemetry Verification      : PASS")

    print("\n")
    print(
        "SECURE UAV TELEMETRY PIPELINE COMPLETE"
    )


if __name__ == "__main__":

    run_hybrid_secure_pipeline()