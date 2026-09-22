"""
AERO-SENTINEL Secure Telemetry Pipeline

Demonstrates the complete prototype security flow:

Engine telemetry
    ↓
Device authentication
    ↓
ML-KEM-768 key establishment
    ↓
HKDF key derivation
    ↓
AES-256-GCM encryption
    ↓
Replay protection
    ↓
Decryption
    ↓
Telemetry recovered

QKD is kept as a separate simulated research component.

IMPORTANT:
This is a prototype demonstration.
It is NOT a certified military security system.
"""

import json
import time
import base64

from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from device_auth import (
    generate_device_signature,
    authenticate_device,
)

from pqc_kem import (
    generate_keypair,
    encapsulate_secret,
    decapsulate_secret,
)

from aes_gcm import (
    encrypt_telemetry,
    decrypt_telemetry,
)

from replay_protection import ReplayProtector


DEVICE_ID = "UAV-ENGINE-001"


def derive_aes_key(shared_secret: bytes) -> bytes:
    """
    Derive a 256-bit AES key from the ML-KEM shared secret.

    HKDF-SHA256 is used as the key derivation function.
    """

    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"AERO-SENTINEL-TELEMETRY",
    ).derive(shared_secret)


def create_telemetry():
    """
    Create one simulated engine telemetry packet.
    """

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


def canonical_telemetry(telemetry: dict) -> str:
    """
    Convert telemetry into a consistent string format.
    """

    return json.dumps(
        telemetry,
        sort_keys=True,
        separators=(",", ":"),
    )


def run_secure_pipeline():

    print("\n")
    print("=" * 60)
    print("AERO-SENTINEL SECURE TELEMETRY PIPELINE")
    print("=" * 60)

    # =========================================================
    # STEP 1 — ENGINE TELEMETRY
    # =========================================================

    telemetry = create_telemetry()

    telemetry_message = canonical_telemetry(telemetry)

    print("\n[1] ENGINE TELEMETRY")
    print("--------------------")
    print(telemetry_message)

    # =========================================================
    # STEP 2 — DEVICE AUTHENTICATION
    # =========================================================

    print("\n[2] DEVICE AUTHENTICATION")
    print("-------------------------")

    device_signature = generate_device_signature(
        DEVICE_ID,
        telemetry_message,
    )

    auth_result = authenticate_device(
        DEVICE_ID,
        telemetry_message,
        device_signature,
    )

    print("Device ID:", DEVICE_ID)
    print("Authentication:", auth_result["status"])

    if not auth_result["authenticated"]:
        print("ERROR: Device authentication failed.")
        return

    # =========================================================
    # STEP 3 — ML-KEM KEY ESTABLISHMENT
    # =========================================================

    print("\n[3] ML-KEM-768 KEY ESTABLISHMENT")
    print("--------------------------------")

    print("Generating UAV key pair...")

    public_key, private_key = generate_keypair()

    print("UAV key pair generated.")

    print("Ground station encapsulating shared secret...")

    ciphertext, ground_shared_secret = encapsulate_secret(
        public_key
    )

    print("Ciphertext generated.")

    print("UAV decapsulating shared secret...")

    uav_shared_secret = decapsulate_secret(
        private_key,
        ciphertext,
    )

    if ground_shared_secret != uav_shared_secret:
        print("ERROR: ML-KEM shared secrets do not match.")
        return

    print("SUCCESS: ML-KEM shared secrets MATCH.")

    # =========================================================
    # STEP 4 — HKDF SESSION KEY
    # =========================================================

    print("\n[4] SESSION KEY DERIVATION")
    print("--------------------------")

    session_key = derive_aes_key(
        uav_shared_secret
    )

    print("HKDF-SHA256 completed.")
    print("256-bit AES session key derived.")

    # =========================================================
    # STEP 5 — PACKET METADATA
    # =========================================================

    print("\n[5] PACKET METADATA")
    print("-------------------")

    sequence_number = 1001
    timestamp = time.time()

    associated_data = (
        f"{DEVICE_ID}|"
        f"sequence={sequence_number}|"
        f"timestamp={timestamp}"
    )

    print("Sequence number:", sequence_number)
    print("Timestamp:", timestamp)

    # =========================================================
    # STEP 6 — AES-256-GCM ENCRYPTION
    # =========================================================

    print("\n[6] AES-256-GCM ENCRYPTION")
    print("--------------------------")

    encrypted = encrypt_telemetry(
        telemetry_message,
        session_key,
        associated_data,
    )

    print("Telemetry encrypted.")
    print("Nonce generated.")
    print("Authentication tag generated.")
    print("Encrypted telemetry ready for transmission.")

    # =========================================================
    # STEP 7 — GROUND STATION REPLAY CHECK
    # =========================================================

    print("\n[7] GROUND STATION REPLAY CHECK")
    print("--------------------------------")

    replay_protector = ReplayProtector(
        max_clock_skew_seconds=30
    )

    replay_result = replay_protector.validate_packet(
        device_id=DEVICE_ID,
        sequence_number=sequence_number,
        timestamp=timestamp,
    )

    print("Replay status:", replay_result["status"])
    print("Reason:", replay_result["reason"])

    if not replay_result["accepted"]:
        print("ERROR: Packet rejected by replay protection.")
        return

    # =========================================================
    # STEP 8 — DECRYPTION
    # =========================================================

    print("\n[8] GROUND STATION DECRYPTION")
    print("-----------------------------")

    decrypted_message = decrypt_telemetry(
        encrypted,
        session_key,
        associated_data,
    )

    print("Telemetry decrypted successfully.")

    # =========================================================
    # STEP 9 — VERIFY TELEMETRY
    # =========================================================

    print("\n[9] TELEMETRY VERIFICATION")
    print("--------------------------")

    if decrypted_message == telemetry_message:

        print("SUCCESS: Original telemetry recovered.")

    else:

        print("ERROR: Telemetry mismatch.")
        return

    # =========================================================
    # FINAL RESULT
    # =========================================================

    print("\n")
    print("=" * 60)
    print("SECURE TELEMETRY PIPELINE TEST SUCCESSFUL")
    print("=" * 60)

    print("\nSecurity stages completed:")

    print("1. Device authentication       : PASS")
    print("2. ML-KEM-768 key establishment: PASS")
    print("3. HKDF-SHA256 key derivation  : PASS")
    print("4. AES-256-GCM encryption      : PASS")
    print("5. Replay protection           : PASS")
    print("6. Telemetry decryption        : PASS")
    print("7. Telemetry verification      : PASS")

    print("\nEngine telemetry successfully")
    print("protected from UAV to ground station.")


if __name__ == "__main__":
    run_secure_pipeline()