"""
AERO-SENTINEL Telemetry Integrity

Provides SHA-256 integrity verification for telemetry.

AES-256-GCM already provides authenticated encryption.
This module is included as an additional explicit integrity
demonstration for the prototype architecture.
"""

import hashlib
import hmac


def calculate_integrity(data: str) -> str:
    """
    Calculate SHA-256 hash of telemetry data.
    """

    return hashlib.sha256(
        data.encode("utf-8")
    ).hexdigest()


def verify_integrity(
    data: str,
    expected_hash: str,
) -> bool:
    """
    Verify that telemetry has not changed.
    """

    actual_hash = calculate_integrity(data)

    return hmac.compare_digest(
        actual_hash,
        expected_hash,
    )


def test_integrity():
    print("\nAERO-SENTINEL INTEGRITY TEST")
    print("----------------------------")

    telemetry = (
        "device=UAV-ENGINE-001;"
        "rpm=2400;"
        "egt=700;"
        "cht=155"
    )

    print("\n[1] Calculating telemetry hash...")

    original_hash = calculate_integrity(telemetry)

    print("SHA-256 hash generated.")

    print("\n[2] Verifying original telemetry...")

    valid = verify_integrity(
        telemetry,
        original_hash,
    )

    print(
        "SUCCESS: Integrity verified."
        if valid
        else "ERROR: Integrity verification failed."
    )

    print("\n[3] Testing modified telemetry...")

    modified_telemetry = (
        "device=UAV-ENGINE-001;"
        "rpm=5000;"
        "egt=700;"
        "cht=155"
    )

    valid = verify_integrity(
        modified_telemetry,
        original_hash,
    )

    print(
        "ERROR: Modified telemetry accepted."
        if valid
        else "SUCCESS: Modified telemetry rejected."
    )


if __name__ == "__main__":
    test_integrity()