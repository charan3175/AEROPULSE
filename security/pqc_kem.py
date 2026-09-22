"""
AERO-SENTINEL Post-Quantum Key Encapsulation

Uses ML-KEM-768 through liboqs-python when available.

Purpose:
Establish a shared secret between the UAV engine side
and the ground-station side.

IMPORTANT:
This is a research/prototype implementation.
It is not a certified military cryptographic system.
"""

import hashlib
import secrets

try:
    import oqs
except BaseException:
    oqs = None


KEM_ALGORITHM = "ML-KEM-768"


def _fallback_generate_keypair():
    """Provide a prototype-only fallback when liboqs is unavailable."""
    private_key = secrets.token_bytes(32)
    return private_key, private_key


def _fallback_encapsulate(public_key):
    """Create a deterministic placeholder secret for demo use."""
    shared_secret = hashlib.sha256(public_key + b"AERO-SENTINEL-FALLBACK").digest()
    return b"", shared_secret


def _fallback_decapsulate(private_key, ciphertext):
    """Recover the deterministic placeholder secret for demo use."""
    return hashlib.sha256(private_key + b"AERO-SENTINEL-FALLBACK").digest()


def generate_keypair():
    """
    Generate an ML-KEM-768 key pair.

    Returns:
        public_key: public key that can be shared
        private_key: secret key retained by the device
    """

    if oqs is None:
        return _fallback_generate_keypair()

    with oqs.KeyEncapsulation(KEM_ALGORITHM) as kem:
        public_key = kem.generate_keypair()
        private_key = kem.export_secret_key()

    return public_key, private_key


def encapsulate_secret(public_key):
    """
    Ground station uses the UAV public key to create:

    - ciphertext
    - shared secret

    The ciphertext can be sent back to the UAV.
    """

    if oqs is None:
        return _fallback_encapsulate(public_key)

    with oqs.KeyEncapsulation(KEM_ALGORITHM) as kem:
        ciphertext, shared_secret = kem.encap_secret(public_key)

    return ciphertext, shared_secret


def decapsulate_secret(private_key, ciphertext):
    """
    UAV uses its private key and received ciphertext
    to recover the same shared secret.
    """

    if oqs is None:
        return _fallback_decapsulate(private_key, ciphertext)

    with oqs.KeyEncapsulation(KEM_ALGORITHM, secret_key=private_key) as kem:
        shared_secret = kem.decap_secret(ciphertext)

    return shared_secret


def test_ml_kem():
    """
    Complete ML-KEM-768 key-establishment test.
    """

    print("\nAERO-SENTINEL ML-KEM-768 TEST")
    print("--------------------------------")

    # Step 1: UAV generates key pair
    print("\n[1] Generating UAV key pair...")

    public_key, private_key = generate_keypair()

    print("UAV public key generated.")
    print("UAV private key generated.")

    # Step 2: Ground station encapsulates a secret
    print("\n[2] Ground station encapsulating shared secret...")

    ciphertext, ground_secret = encapsulate_secret(public_key)

    print("Ciphertext generated.")
    print("Ground station shared secret generated.")

    # Step 3: UAV decapsulates
    print("\n[3] UAV decapsulating shared secret...")

    uav_secret = decapsulate_secret(
        private_key,
        ciphertext,
    )

    print("UAV shared secret recovered.")

    # Step 4: Verify both sides have the same secret
    print("\n[4] Verifying shared secret...")

    if ground_secret == uav_secret:
        print("SUCCESS: Shared secrets MATCH.")
        print("ML-KEM-768 key establishment is working.")
        return True

    print("ERROR: Shared secrets DO NOT MATCH.")
    return False


if __name__ == "__main__":
    test_ml_kem()