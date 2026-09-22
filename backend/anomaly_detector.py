FEATURES = [
    "rpm",
    "egt",
    "cht",
    "oil_pressure",
    "oil_temperature",
    "vibration",
    "fuel_flow",
    "throttle",
]


def detect_anomalies(history):
    """
    AI-based engine anomaly detection using Isolation Forest.

    This is a prototype predictive-maintenance model.
    It is not a certified flight-safety system.
    """

    if not history or len(history) < 15:
        return {
            "status": "INSUFFICIENT DATA",
            "anomaly": False,
            "anomaly_score": 0,
            "confidence": 0,
            "severity": "UNKNOWN",
            "message": (
                "Not enough historical telemetry "
                "for reliable anomaly detection."
            ),
            "samples_analyzed": len(history),
            "features_used": FEATURES,
        }

    try:
        import pandas as pd
        from sklearn.ensemble import IsolationForest

        df = pd.DataFrame(history)

        # Make sure all required features exist
        missing_features = [
            feature for feature in FEATURES
            if feature not in df.columns
        ]

        if missing_features:
            return {
                "status": "INVALID DATA",
                "anomaly": False,
                "anomaly_score": 0,
                "confidence": 0,
                "severity": "UNKNOWN",
                "message": (
                    "Required telemetry features are missing."
                ),
                "samples_analyzed": len(df),
                "features_used": FEATURES,
                "missing_features": missing_features,
            }

        # Select required features
        data = df[FEATURES].copy()

        # Convert values to numeric
        for feature in FEATURES:
            data[feature] = pd.to_numeric(
                data[feature],
                errors="coerce"
            )

        # Remove invalid rows
        data = data.dropna()

        if len(data) < 15:
            return {
                "status": "INSUFFICIENT DATA",
                "anomaly": False,
                "anomaly_score": 0,
                "confidence": 0,
                "severity": "UNKNOWN",
                "message": (
                    "Not enough valid telemetry samples "
                    "for anomaly detection."
                ),
                "samples_analyzed": len(data),
                "features_used": FEATURES,
            }

        # Train Isolation Forest
        model = IsolationForest(
            n_estimators=200,
            contamination=0.05,
            random_state=42,
        )

        model.fit(data)

        # Analyze the latest telemetry sample
        latest = data.iloc[[-1]]

        prediction = model.predict(latest)[0]

        # Isolation Forest decision score
        raw_score = model.decision_function(latest)[0]

        # Convert score to a simple 0-100 anomaly score
        anomaly_score = max(
            0,
            min(
                100,
                round((0.10 - raw_score) * 250, 1)
            )
        )

        # Determine anomaly
        anomaly = prediction == -1

        # Confidence
        if anomaly_score >= 75:
            confidence = 90
        elif anomaly_score >= 50:
            confidence = 80
        elif anomaly_score >= 30:
            confidence = 70
        else:
            confidence = 60

        # Severity
        if not anomaly:
            severity = "LOW"
            message = (
                "Engine behaviour is consistent "
                "with the learned telemetry pattern."
            )

        elif anomaly_score >= 75:
            severity = "CRITICAL"
            message = (
                "Engine behaviour shows a strong deviation "
                "from the learned telemetry pattern."
            )

        elif anomaly_score >= 50:
            severity = "HIGH"
            message = (
                "Engine behaviour shows a significant "
                "deviation from the learned telemetry pattern."
            )

        elif anomaly_score >= 30:
            severity = "MEDIUM"
            message = (
                "Engine behaviour shows a moderate "
                "deviation from the learned telemetry pattern."
            )

        else:
            severity = "LOW"
            message = (
                "Minor deviation detected in engine behaviour."
            )

        return {
            "status": (
                "ANOMALY DETECTED"
                if anomaly
                else "NORMAL"
            ),
            "anomaly": bool(anomaly),
            "anomaly_score": anomaly_score,
            "confidence": confidence,
            "severity": severity,
            "message": message,
            "samples_analyzed": len(data),
            "features_used": FEATURES,
        }

    except Exception as error:
        return {
            "status": "ANOMALY DETECTION ERROR",
            "anomaly": False,
            "anomaly_score": 0,
            "confidence": 0,
            "severity": "UNKNOWN",
            "message": (
                "Anomaly detection could not be completed."
            ),
            "samples_analyzed": len(history),
            "features_used": FEATURES,
            "error": str(error),
        }


if __name__ == "__main__":
    print("AERO-SENTINEL AI Anomaly Detector")
    print("----------------------------------")
    print("Model: Isolation Forest")
    print("Status: Ready")