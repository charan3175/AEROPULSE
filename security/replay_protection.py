"""
AERO-SENTINEL Replay Protection

Purpose:
Prevent captured old telemetry packets from being
accepted again by the ground station.

Protection mechanisms:
- Sequence number validation
- Timestamp freshness validation

Prototype implementation.
"""

import time
from typing import Dict


class ReplayProtector:
    """
    Tracks the latest accepted sequence number
    for each registered device.
    """

    def __init__(self, max_clock_skew_seconds: int = 30):
        self.last_sequence: Dict[str, int] = {}
        self.max_clock_skew_seconds = max_clock_skew_seconds

    def validate_packet(
        self,
        device_id: str,
        sequence_number: int,
        timestamp: float,
    ) -> Dict:

        current_time = time.time()

        # Check timestamp freshness
        age = current_time - timestamp

        if age > self.max_clock_skew_seconds:
            return {
                "accepted": False,
                "status": "REJECTED",
                "reason": "Telemetry packet is too old.",
                "device_id": device_id,
                "sequence_number": sequence_number,
            }

        if age < -self.max_clock_skew_seconds:
            return {
                "accepted": False,
                "status": "REJECTED",
                "reason": "Telemetry packet timestamp is too far in the future.",
                "device_id": device_id,
                "sequence_number": sequence_number,
            }

        # Get the last accepted sequence number
        last_sequence = self.last_sequence.get(device_id)

        # First packet from this device
        if last_sequence is None:
            self.last_sequence[device_id] = sequence_number

            return {
                "accepted": True,
                "status": "ACCEPTED",
                "reason": "First telemetry packet accepted.",
                "device_id": device_id,
                "sequence_number": sequence_number,
            }

        # Reject duplicate or older packets
        if sequence_number <= last_sequence:
            return {
                "accepted": False,
                "status": "REJECTED",
                "reason": "Replay detected: duplicate or older sequence number.",
                "device_id": device_id,
                "sequence_number": sequence_number,
                "last_accepted_sequence": last_sequence,
            }

        # Accept new packet
        self.last_sequence[device_id] = sequence_number

        return {
            "accepted": True,
            "status": "ACCEPTED",
            "reason": "Fresh telemetry packet accepted.",
            "device_id": device_id,
            "sequence_number": sequence_number,
        }


def test_replay_protection():

    print("\nAERO-SENTINEL REPLAY PROTECTION TEST")
    print("------------------------------------")

    protector = ReplayProtector(
        max_clock_skew_seconds=30
    )

    device_id = "UAV-ENGINE-001"

    current_time = time.time()

    # ------------------------------------------------
    # Test 1: Fresh packet
    # ------------------------------------------------

    print("\n[1] Testing fresh telemetry packet...")
    
    result = protector.validate_packet(
        device_id=device_id,
        sequence_number=1001,
        timestamp=current_time,
    )

    print(result)

    # ------------------------------------------------
    # Test 2: New packet
    # ------------------------------------------------

    print("\n[2] Testing newer telemetry packet...")

    result = protector.validate_packet(
        device_id=device_id,
        sequence_number=1002,
        timestamp=time.time(),
    )

    print(result)

    # ------------------------------------------------
    # Test 3: Replay same packet
    # ------------------------------------------------

    print("\n[3] Testing replayed packet...")

    result = protector.validate_packet(
        device_id=device_id,
        sequence_number=1002,
        timestamp=time.time(),
    )

    print(result)

    # ------------------------------------------------
    # Test 4: Older packet
    # ------------------------------------------------

    print("\n[4] Testing older packet...")

    result = protector.validate_packet(
        device_id=device_id,
        sequence_number=999,
        timestamp=time.time(),
    )

    print(result)

    # ------------------------------------------------
    # Test 5: Old timestamp
    # ------------------------------------------------

    print("\n[5] Testing expired telemetry packet...")

    old_timestamp = time.time() - 60

    result = protector.validate_packet(
        device_id=device_id,
        sequence_number=1003,
        timestamp=old_timestamp,
    )

    print(result)


if __name__ == "__main__":
    test_replay_protection()