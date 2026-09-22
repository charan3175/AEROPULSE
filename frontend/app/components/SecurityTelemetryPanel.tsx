"use client";

import { useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck, ShieldX } from "lucide-react";

const API_BASE_URL = "http://127.0.0.1:8003";

const defaultTelemetry = {
  device_id: "UAV-ENGINE-001",
  rpm: 2400,
  egt: 700,
  cht: 155,
  oil_pressure: 4.2,
  vibration: 2.1,
};

type SecurityResult = {
  status?: string;
  passed?: boolean;
  message?: string;
};

const tests = [
  ["valid", "SEND VALID TELEMETRY"],
  ["tampering", "TEST TAMPERING"],
  ["replay", "TEST REPLAY"],
  ["unknown_device", "TEST UNKNOWN DEVICE"],
] as const;

export default function SecurityTelemetryPanel() {
  const [online, setOnline] = useState(false);
  const [open, setOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SecurityResult | null>(null);

  const checkStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/security/status`, {
        cache: "no-store",
      });
      setOnline(response.ok);
    } catch {
      setOnline(false);
    }
  };

  useEffect(() => {
    const initialCheck = setTimeout(checkStatus, 0);
    const interval = setInterval(checkStatus, 10000);
    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, []);

  const runTest = async (testType: string) => {
    setLoading(true);
    try {
      const isValidTelemetry = testType === "valid";
      const response = await fetch(
        `${API_BASE_URL}${isValidTelemetry ? "/security/telemetry" : "/security/test"}`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isValidTelemetry
            ? defaultTelemetry
            : { test_type: testType, telemetry: defaultTelemetry }
        ),
        }
      );
      if (!response.ok) {
        throw new Error(`Security request failed: ${response.status}`);
      }
      const data = await response.json();
      setResult(data);
      setOnline(true);
    } catch (error) {
      console.error("Security test failed:", error);
      setOnline(false);
      setResult({ status: "OFFLINE", passed: false, message: "Security backend unavailable." });
    } finally {
      setLoading(false);
    }
  };

  const protectedChannel = online;
  const resultPassed = result?.passed === true || result?.status === "ACCEPTED";

  return (
    <div className="security-compact">
      <button
        type="button"
        className={`security-trigger ${protectedChannel ? "protected" : "unprotected"}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Show security channel details"
      >
        <LockKeyhole size={15} />
        <span>
          <strong>SECURE CHANNEL</strong>
          <small><i /> {protectedChannel ? "PROTECTED" : "NOT PROTECTED"}</small>
        </span>
      </button>

      {open && (
        <div className="security-popover">
          <div className="security-popover-title">
            <span>SECURE CHANNEL</span>
            <b className={protectedChannel ? "protected-text" : "unprotected-text"}>
              {protectedChannel ? "PROTECTED" : "NOT PROTECTED"}
            </b>
          </div>
          <div className="security-popover-stage"><span>Device Authentication</span><b>✓</b></div>
          <div className="security-popover-stage"><span>ML-KEM-768</span><b>✓</b></div>
          <div className="security-popover-stage"><span>AES-256-GCM</span><b>✓</b></div>
          <div className="security-popover-stage"><span>Replay Protection</span><b>✓</b></div>
          <div className="security-popover-meta"><span>Transport</span><strong>Authenticated + Encrypted</strong></div>
          <div className="security-popover-meta"><span>Mode</span><strong>Prototype Security</strong></div>
          <button type="button" className="security-test-open" onClick={() => setTestOpen(true)}>
            Security Test
          </button>
        </div>
      )}

      {testOpen && (
        <div className="security-modal-backdrop" role="presentation" onClick={() => setTestOpen(false)}>
          <div className="security-test-modal" role="dialog" aria-modal="true" aria-label="Security Test" onClick={(event) => event.stopPropagation()}>
            <div className="security-modal-header">
              <div>
                <span>SECURITY TEST</span>
                <strong>Device: UAV-ENGINE-001</strong>
              </div>
              <button type="button" onClick={() => setTestOpen(false)} aria-label="Close security test">×</button>
            </div>
            <div className="security-test-actions">
              {tests.map(([type, label]) => (
                <button key={type} type="button" disabled={loading} onClick={() => runTest(type)}>{label}</button>
              ))}
            </div>
            {result && (
              <div className={`security-test-result ${resultPassed ? "passed" : "failed"}`}>
                {resultPassed ? <ShieldCheck size={18} /> : <ShieldX size={18} />}
                <div>
                  <strong>Status: {result.status ?? "UNKNOWN"}</strong>
                  <span>Test Result: {resultPassed ? "PASSED" : "FAILED"}</span>
                  <small>{result.message}</small>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
