def calculate_mission_risk(
    health_result,
    fault_result,
    rul_result,
    altitude=4500,
    ambient_temperature=32,
    throttle=70,
    mission_duration=20,
    mission_type="ISR"
):
    """
    Mission-aware risk assessment for the AERO-SENTINEL prototype.

    This prototype combines:
    - engine health
    - detected fault severity
    - estimated RUL
    - altitude
    - ambient temperature
    - throttle
    - mission duration
    - mission type

    IMPORTANT:
    This is a decision-support prototype.
    It is not certified for real flight operations.
    """

    health = health_result["health"]
    severity = fault_result["severity"]

    rul_min = rul_result["rul_min_hours"]
    rul_max = rul_result["rul_max_hours"]

    risk_score = 0
    risk_factors = []

    # ---------------------------------------------------------
    # 1. ENGINE HEALTH
    # ---------------------------------------------------------

    if health < 40:
        risk_score += 35
        risk_factors.append("Very low engine health")

    elif health < 60:
        risk_score += 25
        risk_factors.append("Reduced engine health")

    elif health < 75:
        risk_score += 12
        risk_factors.append("Moderate engine degradation")

    else:
        risk_score += 3

    # ---------------------------------------------------------
    # 2. FAULT SEVERITY
    # ---------------------------------------------------------

    if severity == "CRITICAL":
        risk_score += 40
        risk_factors.append("Critical-severity engine fault")

    elif severity == "HIGH":
        risk_score += 30
        risk_factors.append("High-severity engine fault")

    elif severity == "MEDIUM":
        risk_score += 18
        risk_factors.append("Medium-severity engine fault")

    elif severity == "LOW":
        risk_score += 7
        risk_factors.append("Low-severity engine condition")

    # ---------------------------------------------------------
    # 3. RUL
    # ---------------------------------------------------------

    if rul_max <= 10:
        risk_score += 25
        risk_factors.append("Very limited remaining useful life")

    elif rul_max <= 30:
        risk_score += 18
        risk_factors.append("Reduced remaining useful life")

    elif rul_max <= 50:
        risk_score += 10
        risk_factors.append("Moderate remaining useful life")

    else:
        risk_score += 2

    # ---------------------------------------------------------
    # 4. ALTITUDE
    # ---------------------------------------------------------

    if altitude >= 7000:
        risk_score += 15
        risk_factors.append("High-altitude operating condition")

    elif altitude >= 5000:
        risk_score += 8
        risk_factors.append("Elevated operating altitude")

    # ---------------------------------------------------------
    # 5. AMBIENT TEMPERATURE
    # ---------------------------------------------------------

    if ambient_temperature >= 45:
        risk_score += 15
        risk_factors.append("Very high ambient temperature")

    elif ambient_temperature >= 35:
        risk_score += 8
        risk_factors.append("High ambient temperature")

    # ---------------------------------------------------------
    # 6. THROTTLE
    # ---------------------------------------------------------

    if throttle >= 90:
        risk_score += 15
        risk_factors.append("Very high engine load")

    elif throttle >= 80:
        risk_score += 8
        risk_factors.append("High engine load")

    # ---------------------------------------------------------
    # 7. MISSION DURATION
    # ---------------------------------------------------------

    if mission_duration >= 60:
        risk_score += 15
        risk_factors.append("Long-duration mission")

    elif mission_duration >= 30:
        risk_score += 8
        risk_factors.append("Extended mission duration")

    # ---------------------------------------------------------
    # 8. MISSION TYPE
    # ---------------------------------------------------------

    mission_weights = {
        "ISR": 8,
        "SURVEILLANCE": 8,
        "MARITIME": 10,
        "COMMUNICATION": 6,
        "TRAINING": 2,
        "PATROL": 7,
    }

    mission_weight = mission_weights.get(
        mission_type.upper(),
        5
    )

    risk_score += mission_weight

    # Keep the KPI responsive to continuous telemetry changes instead of
    # changing only when a threshold is crossed.
    risk_score += max(0, 85 - health) * 0.25
    risk_score += max(0, throttle - 70) * 0.05

    risk_factors.append(
        f"{mission_type} mission profile"
    )

    # ---------------------------------------------------------
    # LIMIT SCORE
    # ---------------------------------------------------------

    risk_score = min(100, max(0, risk_score))

    # ---------------------------------------------------------
    # RISK LEVEL
    # ---------------------------------------------------------

    if risk_score >= 75:
        risk_level = "CRITICAL"

    elif risk_score >= 50:
        risk_level = "HIGH"

    elif risk_score >= 25:
        risk_level = "MEDIUM"

    else:
        risk_level = "LOW"

    # ---------------------------------------------------------
    # SAFETY OVERRIDE
    # ---------------------------------------------------------
    # A critical engine fault should never result in a
    # low/medium mission risk classification.

    if severity == "CRITICAL":
        risk_score = max(risk_score, 75)
        risk_level = "CRITICAL"

        if "Critical engine fault requires mission restriction" not in risk_factors:
            risk_factors.append(
                "Critical engine fault requires mission restriction"
            )

    # ---------------------------------------------------------
    # DECISION
    # ---------------------------------------------------------

    if risk_level == "CRITICAL":

        decision = "MISSION NOT RECOMMENDED"

        recommendation = (
            "Do not proceed with the planned mission. "
            "Perform engine inspection and maintenance."
        )

    elif risk_level == "HIGH":

        decision = "MISSION REVIEW REQUIRED"

        recommendation = (
            "Mission requires operator review. "
            "Consider reducing mission load or duration "
            "and schedule preventive maintenance."
        )

    elif risk_level == "MEDIUM":

        decision = "PROCEED WITH CAUTION"

        recommendation = (
            "Continue enhanced engine monitoring "
            "and review mission conditions."
        )

    else:

        decision = "MISSION ACCEPTABLE"

        recommendation = (
            "Current engine condition and mission "
            "conditions are within the prototype "
            "risk limits."
        )

    # ---------------------------------------------------------
    # RETURN RESULT
    # ---------------------------------------------------------

    return {
        "risk_score": round(risk_score, 1),
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "decision": decision,
        "recommendation": recommendation,

        "mission_profile": {
            "mission_type": mission_type,
            "altitude": altitude,
            "ambient_temperature": ambient_temperature,
            "throttle": throttle,
            "mission_duration": mission_duration,
        },

        "engine_condition": {
            "health": health,
            "fault": fault_result["fault"],
            "fault_severity": severity,
            "rul_min_hours": rul_min,
            "rul_max_hours": rul_max,
        }
    }