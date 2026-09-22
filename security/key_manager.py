"""
AERO-SENTINEL Hybrid Key Manager

Combines:
- ML-KEM-768 shared secret
- Simulated QKD key
- HKDF-SHA256
- AES-256 session-key derivation

IMPORTANT:
QKD in this project is a simulation.
ML-KEM-768 is the practical post-quantum mechanism.

This is a research/prototype implementation.
"""

import hashlib
import secrets

from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from .pqc_kem import (
    generate_keypair,
    encapsulate_secret,
    decapsulate_secret,
)

from .qkd_simulator import generate_qkd_key


def combine_secrets(
    ml_kem_secret: bytes,
    qkd_key: bytes,
) -> bytes:
    """
    Combine ML-KEM and QKD key material.

    Both secrets are combined before deriving
    the final AES session key.
    """

    combined = (
        b"AERO-SENTINEL-HYBRID-KEY"
        + ml_kem_secret
        + qkd_key
    )

    return hashlib.sha256(combined).digest()


def derive_session_key(
    combined_secret: bytes,
) -> bytes:
    """
    Derive a 256-bit AES session key using HKDF-SHA256.
    """

    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"AERO-SENTINEL-SESSION-KEY",
    ).derive(combined_secret)


def establish_hybrid_session():
    """
    Perform the complete hybrid key-establishment process.
    """

    print("\nAERO-SENTINEL HYBRID KEY MANAGER")
    print("================================")

    # -------------------------------------------------
    # 1. ML-KEM
    # -------------------------------------------------

    print("\n[1] ML-KEM-768 KEY ESTABLISHMENT")
    print("--------------------------------")

    public_key, private_key = generate_keypair()

    ciphertext, ground_ml_kem_secret = (
        encapsulate_secret(public_key)
    )

    uav_ml_kem_secret = decapsulate_secret(
        private_key,
        ciphertext,
    )

    if ground_ml_kem_secret != uav_ml_kem_secret:
        print("ERROR: ML-KEM secrets do not match.")
        return None

    print("ML-KEM shared secret: MATCH")
    print("ML-KEM status: SUCCESS")

    # -------------------------------------------------
    # 2. QKD simulation
    # -------------------------------------------------

    print("\n[2] QKD SIMULATION")
    print("------------------")

    uav_qkd_key = generate_qkd_key(32)

    # Simulation:
    # Both sides receive the same QKD key.
    ground_qkd_key = uav_qkd_key

    if uav_qkd_key != ground_qkd_key:
        print("ERROR: QKD keys do not match.")
        return None

    print("QKD key: MATCH")
    print("QKD status: SUCCESS")

    # -------------------------------------------------
    # 3. Combine key material
    # -------------------------------------------------

    print("\n[3] HYBRID KEY COMBINATION")
    print("--------------------------")

    uav_combined = combine_secrets(
        uav_ml_kem_secret,
        uav_qkd_key,
    )

    ground_combined = combine_secrets(
        ground_ml_kem_secret,
        ground_qkd_key,
    )

    if uav_combined != ground_combined:
        print("ERROR: Hybrid key material does not match.")
        return None

    print("ML-KEM + QKD key material: MATCH")

    # -------------------------------------------------
    # 4. Derive AES session key
    # -------------------------------------------------

    print("\n[4] SESSION KEY DERIVATION")
    print("--------------------------")

    uav_session_key = derive_session_key(
        uav_combined
    )

    ground_session_key = derive_session_key(
        ground_combined
    )

    if uav_session_key != ground_session_key:
        print("ERROR: Session keys do not match.")
        return None

    print("HKDF-SHA256: SUCCESS")
    print("AES-256 session key: MATCH")
    print("Session key length:", len(uav_session_key), "bytes")

    # -------------------------------------------------
    # 5. Final result
    # -------------------------------------------------

    print("\n================================")
    print("HYBRID KEY ESTABLISHMENT SUCCESS")
    print("================================")

    print("\nKey flow:")
    print("ML-KEM-768")
    print("     +")
    print("QKD Simulation")
    print("     ↓")
    print("Hybrid Key Material")
    print("     ↓")
    print("HKDF-SHA256")
    print("     ↓")
    print("256-bit AES Session Key")

    return uav_session_key


if __name__ == "__main__":
    establish_hybrid_session()