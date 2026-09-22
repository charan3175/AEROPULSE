"""
AERO-SENTINEL Security Attack Tests

Tests:
1. Tampered encrypted telemetry
2. Replay attack
3. Unknown device
4. Invalid device authentication

Prototype security demonstration.
"""

import base64
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


def test_tampered_encrypted_telemetry(session_key):
    print("\n")
    print("=" * 65)
    print("ATTACK TEST 1: TAMPERED ENCRYPTED TELEMETRY")
    print("=" * 65)

    telemetry = (
        "device=UAV-ENGINE-001;"
        "rpm=2400;"
        "egt=700;"
        "cht=155;"
        "oil_pressure=4.2"
    )

    sequence_number = 3001
    timestamp = time.time()

    associated_data = (
        f"{DEVICE_ID}|"
        f"sequence={sequence_number}|"
        f"timestamp={timestamp}"
    )

    encrypted = encrypt_telemetry(
        telemetry,
        session_key,
        associated_data,
    )

    print("\nOriginal telemetry:")
    print(telemetry)

    print("\nAttacker modifies encrypted telemetry...")

    # Decode encrypted ciphertext
    ciphertext = base64.b64decode(
        encrypted["ciphertext"]
    )

    # Modify one byte
    modified_ciphertext = bytearray(ciphertext)
    modified_ciphertext[0] ^= 1

    # Encode modified ciphertext again
    tampered_encrypted = encrypted.copy()

    tampered_encrypted["ciphertext"] = (
        base64.b64encode(
            bytes(modified_ciphertext)
        ).decode()
    )

    try:

        decrypt_telemetry(
            tampered_encrypted,
            session_key,
            associated_data,
        )

        print(
            "ERROR: Tampered encrypted telemetry accepted."
        )

        return False

    except Exception:

        print(
            "SUCCESS: AES-256-GCM rejected tampered telemetry."
        )

        return True


def test_replay_attack():

    print("\n")
    print("=" * 65)
    print("ATTACK TEST 2: REPLAYED PACKET")
    print("=" * 65)

    replay_protector = ReplayProtector(
        max_clock_skew_seconds=30
    )

    sequence_number = 4001
    timestamp = time.time()

    print("\nSending original packet...")

    first_result = replay_protector.validate_packet(
        device_id=DEVICE_ID,
        sequence_number=sequence_number,
        timestamp=timestamp,
    )

    print(
        "First packet:",
        first_result["status"]
    )

    print("\nAttacker resends the same packet...")

    replay_result = replay_protector.validate_packet(
        device_id=DEVICE_ID,
        sequence_number=sequence_number,
        timestamp=timestamp,
    )

    print(
        "Replay packet:",
        replay_result["status"]
    )

    print(
        "Reason:",
        replay_result["reason"]
    )

    if replay_result["accepted"]:

        print(
            "ERROR: Replayed packet was accepted."
        )

        return False

    print(
        "SUCCESS: Replayed packet rejected."
    )

    return True


def test_unknown_device():

    print("\n")
    print("=" * 65)
    print("ATTACK TEST 3: UNKNOWN UAV DEVICE")
    print("=" * 65)

    unknown_device = "UAV-ATTACKER-999"

    fake_signature = "invalid-signature"

    telemetry = (
        "device=UAV-ATTACKER-999;"
        "rpm=2400;"
        "egt=700"
    )

    print(
        "\nDevice attempting transmission:",
        unknown_device
    )

    result = authenticate_device(
        unknown_device,
        telemetry,
        fake_signature,
    )

    print(
        "Authentication:",
        result["status"]
    )

    print(
        "Reason:",
        result["reason"]
    )

    if result["authenticated"]:

        print(
            "ERROR: Unknown device was accepted."
        )

        return False

    print(
        "SUCCESS: Unknown device rejected."
    )

    return True


def test_tampered_authenticated_telemetry():

    print("\n")
    print("=" * 65)
    print("ATTACK TEST 4: AUTHENTICATED TELEMETRY MODIFICATION")
    print("=" * 65)

    telemetry = (
        "device=UAV-ENGINE-001;"
        "rpm=2400;"
        "egt=700"
    )

    signature = generate_device_signature(
        DEVICE_ID,
        telemetry,
    )

    modified_telemetry = (
        "device=UAV-ENGINE-001;"
        "rpm=2400;"
        "egt=950"
    )

    print("\nOriginal EGT: 700")
    print("Modified EGT: 950")

    result = authenticate_device(
        DEVICE_ID,
        modified_telemetry,
        signature,
    )

    print(
        "Authentication:",
        result["status"]
    )

    print(
        "Reason:",
        result["reason"]
    )

    if result["authenticated"]:

        print(
            "ERROR: Modified telemetry accepted."
        )

        return False

    print(
        "SUCCESS: HMAC authentication rejected modified telemetry."
    )

    return True


def run_security_attack_tests():

    print("\n")
    print("=" * 65)
    print("AERO-SENTINEL SECURITY ATTACK TESTS")
    print("=" * 65)

    # ---------------------------------------------------------
    # Establish secure session
    # ---------------------------------------------------------

    print("\n[1] ESTABLISHING HYBRID SESSION")
    print("-------------------------------")

    session_key = establish_hybrid_session()

    if session_key is None:

        print(
            "\nERROR: Hybrid session establishment failed."
        )

        return

    print(
        "\nSession key established successfully."
    )

    # ---------------------------------------------------------
    # Run attacks
    # ---------------------------------------------------------

    result_1 = test_tampered_encrypted_telemetry(
        session_key
    )

    result_2 = test_replay_attack()

    result_3 = test_unknown_device()

    result_4 = test_tampered_authenticated_telemetry()

    # ---------------------------------------------------------
    # Final summary
    # ---------------------------------------------------------

    print("\n")
    print("=" * 65)
    print("SECURITY ATTACK TEST SUMMARY")
    print("=" * 65)

    print(
        "\nTampered encrypted telemetry :",
        "REJECTED" if result_1 else "FAILED"
    )

    print(
        "Replay packet                :",
        "REJECTED" if result_2 else "FAILED"
    )

    print(
        "Unknown device               :",
        "REJECTED" if result_3 else "FAILED"
    )

    print(
        "Modified authenticated data  :",
        "REJECTED" if result_4 else "FAILED"
    )

    all_passed = (
        result_1
        and result_2
        and result_3
        and result_4
    )

    print("\n")

    if all_passed:

        print(
            "ALL SECURITY ATTACK TESTS PASSED"
        )

    else:

        print(
            "SOME SECURITY ATTACK TESTS FAILED"
        )

    print("=" * 65)


if __name__ == "__main__":

    run_security_attack_tests()