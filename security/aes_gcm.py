"""
AERO-SENTINEL AES-256-GCM Encryption

Purpose:
Encrypt engine telemetry using authenticated encryption.

AES-256-GCM provides:
- Confidentiality
- Integrity/authentication
- Detection of modified ciphertext

Prototype implementation.
"""


import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


KEY_SIZE = 32       # 32 bytes = 256 bits
NONCE_SIZE = 12     # Recommended GCM nonce size


def generate_session_key() -> bytes:
    """
    Generate a random 256-bit AES session key.
    """

    return os.urandom(KEY_SIZE)


def encrypt_telemetry(
    telemetry: str,
    session_key: bytes,
    associated_data: str = "",
) -> dict:
    """
    Encrypt telemetry using AES-256-GCM.

    The associated data is authenticated but not encrypted.
    """

    if len(session_key) != KEY_SIZE:
        raise ValueError("AES-256 requires a 32-byte key.")

    nonce = os.urandom(NONCE_SIZE)

    aes = AESGCM(session_key)

    ciphertext = aes.encrypt(
        nonce,
        telemetry.encode("utf-8"),
        associated_data.encode("utf-8"),
    )

    return {
        "nonce": base64.b64encode(nonce).decode("utf-8"),
        "ciphertext": base64.b64encode(ciphertext).decode("utf-8"),
    }


def decrypt_telemetry(
    encrypted_data: dict,
    session_key: bytes,
    associated_data: str = "",
) -> str:
    """
    Decrypt and authenticate AES-256-GCM telemetry.
    """

    if len(session_key) != KEY_SIZE:
        raise ValueError("AES-256 requires a 32-byte key.")

    nonce = base64.b64decode(
        encrypted_data["nonce"]
    )

    ciphertext = base64.b64decode(
        encrypted_data["ciphertext"]
    )

    aes = AESGCM(session_key)

    plaintext = aes.decrypt(
        nonce,
        ciphertext,
        associated_data.encode("utf-8"),
    )

    return plaintext.decode("utf-8")


def test_aes_gcm():
    """
    Test encryption, decryption and tamper detection.
    """

    print("\nAERO-SENTINEL AES-256-GCM TEST")
    print("--------------------------------")

    telemetry = (
        "device=UAV-ENGINE-001;"
        "rpm=2400;"
        "egt=700;"
        "cht=155;"
        "oil_pressure=4.2"
    )

    associated_data = "UAV-ENGINE-001|sequence=1001"

    print("\n[1] Generating AES-256 session key...")

    session_key = generate_session_key()

    print("256-bit session key generated.")

    print("\n[2] Encrypting telemetry...")

    encrypted = encrypt_telemetry(
        telemetry,
        session_key,
        associated_data,
    )

    print("Telemetry encrypted.")
    print("Ciphertext generated.")

    print("\n[3] Decrypting telemetry...")

    decrypted = decrypt_telemetry(
        encrypted,
        session_key,
        associated_data,
    )

    print("Decrypted telemetry:")
    print(decrypted)

    print("\n[4] Verifying original telemetry...")

    if decrypted == telemetry:
        print("SUCCESS: Telemetry recovered correctly.")
    else:
        print("ERROR: Telemetry mismatch.")
        return

    print("\n[5] Testing tamper detection...")

    tampered = encrypted.copy()

    ciphertext_bytes = bytearray(
        base64.b64decode(tampered["ciphertext"])
    )

    ciphertext_bytes[0] ^= 1

    tampered["ciphertext"] = base64.b64encode(
        bytes(ciphertext_bytes)
    ).decode("utf-8")

    try:
        decrypt_telemetry(
            tampered,
            session_key,
            associated_data,
        )

        print("ERROR: Tampered data was accepted.")

    except Exception:
        print("SUCCESS: Tampered telemetry was rejected.")


if __name__ == "__main__":
    test_aes_gcm()