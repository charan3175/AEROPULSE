import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl


# =========================================================
# FUZZY ENGINE HEALTH MODEL
# =========================================================

# ---------------------------------------------------------
# INPUT VARIABLES
# ---------------------------------------------------------

egt = ctrl.Antecedent(
    np.arange(600, 851, 1),
    "egt"
)

cht = ctrl.Antecedent(
    np.arange(100, 211, 1),
    "cht"
)

oil_pressure = ctrl.Antecedent(
    np.arange(0, 6.1, 0.1),
    "oil_pressure"
)

oil_temperature = ctrl.Antecedent(
    np.arange(60, 131, 1),
    "oil_temperature"
)

vibration = ctrl.Antecedent(
    np.arange(0, 6.1, 0.1),
    "vibration"
)


# ---------------------------------------------------------
# OUTPUT
# ---------------------------------------------------------

engine_health = ctrl.Consequent(
    np.arange(0, 101, 1),
    "engine_health"
)


# =========================================================
# MEMBERSHIP FUNCTIONS
# =========================================================

# ---------------------------------------------------------
# EGT
# ---------------------------------------------------------

egt["low"] = fuzz.trimf(
    egt.universe,
    [600, 600, 650]
)

egt["normal"] = fuzz.trimf(
    egt.universe,
    [640, 680, 715]
)

egt["high"] = fuzz.trimf(
    egt.universe,
    [700, 745, 790]
)

egt["very_high"] = fuzz.trimf(
    egt.universe,
    [760, 820, 850]
)


# ---------------------------------------------------------
# CHT
# ---------------------------------------------------------

cht["low"] = fuzz.trimf(
    cht.universe,
    [100, 100, 135]
)

cht["normal"] = fuzz.trimf(
    cht.universe,
    [125, 150, 168]
)

cht["high"] = fuzz.trimf(
    cht.universe,
    [160, 180, 195]
)

cht["very_high"] = fuzz.trimf(
    cht.universe,
    [185, 200, 210]
)


# ---------------------------------------------------------
# OIL PRESSURE
# ---------------------------------------------------------

oil_pressure["low"] = fuzz.trimf(
    oil_pressure.universe,
    [0, 0, 2.8]
)

oil_pressure["normal"] = fuzz.trimf(
    oil_pressure.universe,
    [3.0, 4.3, 5.0]
)

oil_pressure["high"] = fuzz.trimf(
    oil_pressure.universe,
    [4.7, 5.5, 6.0]
)


# ---------------------------------------------------------
# OIL TEMPERATURE
# ---------------------------------------------------------

oil_temperature["low"] = fuzz.trimf(
    oil_temperature.universe,
    [60, 60, 80]
)

oil_temperature["normal"] = fuzz.trimf(
    oil_temperature.universe,
    [75, 90, 103]
)

oil_temperature["high"] = fuzz.trimf(
    oil_temperature.universe,
    [100, 115, 125]
)

oil_temperature["very_high"] = fuzz.trimf(
    oil_temperature.universe,
    [120, 130, 130]
)


# ---------------------------------------------------------
# VIBRATION
# ---------------------------------------------------------

vibration["low"] = fuzz.trimf(
    vibration.universe,
    [0, 0, 2.0]
)

vibration["normal"] = fuzz.trimf(
    vibration.universe,
    [1.5, 2.0, 2.7]
)

vibration["high"] = fuzz.trimf(
    vibration.universe,
    [2.4, 3.5, 4.5]
)

vibration["very_high"] = fuzz.trimf(
    vibration.universe,
    [4.0, 5.5, 6.0]
)


# =========================================================
# HEALTH OUTPUT MEMBERSHIP FUNCTIONS
# =========================================================

engine_health["critical"] = fuzz.trimf(
    engine_health.universe,
    [0, 0, 35]
)

engine_health["poor"] = fuzz.trimf(
    engine_health.universe,
    [25, 40, 55]
)

engine_health["warning"] = fuzz.trimf(
    engine_health.universe,
    [45, 60, 75]
)

engine_health["good"] = fuzz.trimf(
    engine_health.universe,
    [65, 80, 90]
)

engine_health["excellent"] = fuzz.trimf(
    engine_health.universe,
    [85, 95, 100]
)


# =========================================================
# FUZZY RULES
# =========================================================

rules = [

    # -----------------------------------------------------
    # CRITICAL CONDITIONS
    # -----------------------------------------------------

    ctrl.Rule(
        egt["very_high"] & cht["very_high"],
        engine_health["critical"]
    ),

    ctrl.Rule(
        oil_pressure["low"] & vibration["very_high"],
        engine_health["critical"]
    ),

    ctrl.Rule(
        egt["very_high"] & oil_temperature["very_high"],
        engine_health["critical"]
    ),

    # -----------------------------------------------------
    # POOR CONDITIONS
    # -----------------------------------------------------

    ctrl.Rule(
        egt["high"] & cht["high"],
        engine_health["poor"]
    ),

    ctrl.Rule(
        oil_pressure["low"] & egt["high"],
        engine_health["poor"]
    ),

    ctrl.Rule(
        vibration["high"] & cht["high"],
        engine_health["poor"]
    ),

    # -----------------------------------------------------
    # WARNING CONDITIONS
    # -----------------------------------------------------

    ctrl.Rule(
        egt["high"] & cht["normal"],
        engine_health["warning"]
    ),

    ctrl.Rule(
        egt["normal"] & cht["high"],
        engine_health["warning"]
    ),

    ctrl.Rule(
        oil_temperature["high"] & egt["normal"],
        engine_health["warning"]
    ),

    ctrl.Rule(
        vibration["high"] & egt["normal"],
        engine_health["warning"]
    ),

    # -----------------------------------------------------
    # GOOD CONDITION
    # -----------------------------------------------------

    ctrl.Rule(
        egt["normal"] &
        cht["normal"] &
        oil_pressure["normal"] &
        oil_temperature["normal"] &
        vibration["normal"],
        engine_health["good"]
    ),

    # -----------------------------------------------------
    # EXCELLENT CONDITION
    # -----------------------------------------------------

    ctrl.Rule(
        egt["normal"] &
        cht["normal"] &
        oil_pressure["normal"] &
        oil_temperature["normal"] &
        vibration["low"],
        engine_health["excellent"]
    ),

    # -----------------------------------------------------
    # STABLE ENGINE CONDITION
    # -----------------------------------------------------

    ctrl.Rule(
        egt["normal"] &
        cht["normal"] &
        oil_pressure["normal"] &
        oil_temperature["normal"],
        engine_health["good"]
    ),
]


# =========================================================
# CONTROL SYSTEM
# =========================================================

health_control_system = ctrl.ControlSystem(
    rules
)

health_simulator = ctrl.ControlSystemSimulation(
    health_control_system
)


# =========================================================
# MAIN FUNCTION
# =========================================================

def calculate_fuzzy_health(engine_data):

    try:

        # -------------------------------------------------
        # READ TELEMETRY
        # -------------------------------------------------

        egt_value = float(engine_data["egt"])
        cht_value = float(engine_data["cht"])
        oil_pressure_value = float(
            engine_data["oil_pressure"]
        )
        oil_temperature_value = float(
            engine_data["oil_temperature"]
        )
        vibration_value = float(
            engine_data["vibration"]
        )

        # -------------------------------------------------
        # LIMIT VALUES TO FUZZY UNIVERSE
        # -------------------------------------------------

        egt_value = np.clip(
            egt_value,
            600,
            850
        )

        cht_value = np.clip(
            cht_value,
            100,
            210
        )

        oil_pressure_value = np.clip(
            oil_pressure_value,
            0,
            6
        )

        oil_temperature_value = np.clip(
            oil_temperature_value,
            60,
            130
        )

        vibration_value = np.clip(
            vibration_value,
            0,
            6
        )

        # -------------------------------------------------
        # PROVIDE INPUTS
        # -------------------------------------------------

        health_simulator.input["egt"] = egt_value
        health_simulator.input["cht"] = cht_value
        health_simulator.input["oil_pressure"] = (
            oil_pressure_value
        )
        health_simulator.input["oil_temperature"] = (
            oil_temperature_value
        )
        health_simulator.input["vibration"] = (
            vibration_value
        )

        # -------------------------------------------------
        # RUN FUZZY INFERENCE
        # -------------------------------------------------

        health_simulator.compute()

        health = float(
            health_simulator.output["engine_health"]
        )

        health = round(
            max(0, min(100, health)),
            1
        )

        # -------------------------------------------------
        # NORMAL-ENGINE CONSISTENCY CHECK
        #
        # This keeps clearly healthy prototype telemetry
        # from being shown as a degraded engine.
        # -------------------------------------------------

        clearly_normal = (
            640 <= egt_value <= 710
            and 135 <= cht_value <= 170
            and 3.5 <= oil_pressure_value <= 5.0
            and 75 <= oil_temperature_value <= 103
            and vibration_value <= 2.7
        )

        if clearly_normal:
            health = max(health, 85.0)

        # -------------------------------------------------
        # DETERMINE STATUS
        # -------------------------------------------------

        if health >= 85:

            status = "EXCELLENT"
            severity = "LOW"

        elif health >= 70:

            status = "GOOD"
            severity = "LOW"

        elif health >= 50:

            status = "WARNING"
            severity = "MEDIUM"

        elif health >= 30:

            status = "POOR"
            severity = "HIGH"

        else:

            status = "CRITICAL"
            severity = "CRITICAL"

        # -------------------------------------------------
        # EXPLANATION
        # -------------------------------------------------

        reasons = []

        if egt_value > 720:
            reasons.append(
                "Exhaust Gas Temperature is elevated"
            )

        if cht_value > 170:
            reasons.append(
                "Cylinder Head Temperature is elevated"
            )

        if oil_pressure_value < 3.0:
            reasons.append(
                "Oil pressure is low"
            )

        if oil_temperature_value > 105:
            reasons.append(
                "Oil temperature is elevated"
            )

        if vibration_value > 2.7:
            reasons.append(
                "Engine vibration is elevated"
            )

        if not reasons:
            reasons.append(
                "Engine parameters are within "
                "the normal operating region"
            )

        # -------------------------------------------------
        # RECOMMENDATION
        # -------------------------------------------------

        if severity == "CRITICAL":

            recommendation = (
                "Immediate engine inspection required "
                "before mission."
            )

        elif severity == "HIGH":

            recommendation = (
                "Maintenance inspection recommended "
                "before extended operation."
            )

        elif severity == "MEDIUM":

            recommendation = (
                "Continue enhanced monitoring and "
                "review affected parameters."
            )

        else:

            recommendation = (
                "Continue normal engine monitoring."
            )

        # -------------------------------------------------
        # RETURN ANALYSIS
        # -------------------------------------------------

        return {
            "health": health,
            "status": status,
            "severity": severity,
            "reason": "; ".join(reasons),
            "recommendation": recommendation,
            "model": "FUZZY LOGIC",
            "inputs": {
                "egt": egt_value,
                "cht": cht_value,
                "oil_pressure": oil_pressure_value,
                "oil_temperature": oil_temperature_value,
                "vibration": vibration_value,
            }
        }

    except Exception as error:

        return {
            "health": 0,
            "status": "ERROR",
            "severity": "UNKNOWN",
            "reason": (
                "Fuzzy health calculation failed."
            ),
            "recommendation": (
                "Check telemetry inputs and fuzzy model."
            ),
            "model": "FUZZY LOGIC",
            "error": str(error)
        }


# =========================================================
# TEST
# =========================================================

if __name__ == "__main__":

    test_cases = {

        "NORMAL": {
            "rpm": 2400,
            "egt": 680,
            "cht": 155,
            "oil_pressure": 4.4,
            "oil_temperature": 92,
            "vibration": 2.0
        },

        "LOW OIL": {
            "rpm": 2437,
            "egt": 697,
            "cht": 158,
            "oil_pressure": 2.17,
            "oil_temperature": 102.9,
            "vibration": 2.39
        }
    }

    print("\n==============================================")
    print("        AERO-SENTINEL FUZZY HEALTH MODEL")
    print("==============================================")

    for name, data in test_cases.items():

        result = calculate_fuzzy_health(data)

        print(f"\n--- {name} ---")
        print(f"Health   : {result['health']}%")
        print(f"Status   : {result['status']}")
        print(f"Severity : {result['severity']}")
        print(f"Reason   : {result['reason']}")

    print("\n==============================================")