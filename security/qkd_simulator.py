"""
AERO-SENTINEL QKD Simulator

Prototype simulation of a Quantum Key Distribution
key-generation process.

IMPORTANT:
This does NOT perform real quantum communication.
It only simulates the concept for research/demo purposes.
"""

import hashlib
import secrets
from typing import Dict


def generate_qkd_key(length: int = 32) -> bytes:
    """
    Generate a simulated QKD key.
    """

    if length <= 0:
        raise ValueError("Key length must be positive.")

    return secrets.token_bytes(length)


def derive_qkd_fingerprint(key: bytes) -> str:
    """
    Generate a fingerprint for the simulated QKD key.

    The actual key is never displayed.
    """

    return hashlib.sha256(key).hexdigest()


def simulate_qkd_exchange() -> Dict:
    """
    Simulate a QKD-style key exchange.

    In this prototype both sides receive the same
    simulated secure key.
    """

    uav_key = generate_qkd_key(32)

    # Simulation:
    # UAV and ground station receive the same key.
    ground_key = uav_key

    uav_fingerprint = derive_qkd_fingerprint(uav_key)
    ground_fingerprint = derive_qkd_fingerprint(ground_key)

    keys_match = uav_key == ground_key

    return {
        "protocol": "QKD-SIMULATION",
        "key_length_bytes": len(uav_key),
        "uav_fingerprint": uav_fingerprint,
        "ground_fingerprint": ground_fingerprint,
        "keys_match": keys_match,
        "status": "SUCCESS" if keys_match else "FAILED",
    }


def test_qkd_simulator():

    print("\nAERO-SENTINEL QKD SIMULATOR")
    print("---------------------------")

    result = simulate_qkd_exchange()

    print("\nProtocol:")
    print(result["protocol"])

    print("\nKey length:")
    print(f'{result["key_length_bytes"]} bytes')

    print("\nUAV key fingerprint:")
    print(result["uav_fingerprint"])

    print("\nGround station key fingerprint:")
    print(result["ground_fingerprint"])

    print("\nKey verification:")
    print(
        "MATCH"
        if result["keys_match"]
        else "MISMATCH"
    )

    print("\nStatus:")
    print(result["status"])


if __name__ == "__main__":
    test_qkd_simulator()