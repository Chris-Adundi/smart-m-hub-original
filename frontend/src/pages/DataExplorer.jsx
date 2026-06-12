import React, { useEffect, useState } from "react";
import { apiClient } from "@/App";

export default function DataExplorer() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  const endpoints = [
    "schools",
    "students",
    "staff",
    "payments",
    "attendance",
    "exams",
    "results",
    "announcements",
    "finance/transactions",
    "dashboard/stats",
  ];

  useEffect(() => {
    let isMounted = true;

    async function loadAll() {
      const results = {};

      try {
        await Promise.all(
          endpoints.map(async (ep) => {
            try {
              const res = await apiClient.get(`/${ep}`);
              results[ep] = res?.data ?? {};
            } catch (err) {
              results[ep] = {
                error:
                  err?.response?.data?.detail ||
                  err.message ||
                  "Request failed",
              };
            }
          })
        );

        if (isMounted) {
          setData(results);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setData({ error: "Failed to load data explorer" });
          setLoading(false);
        }
      }
    }

    loadAll();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Loading backend data...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>🔍 Smart-M Hub Data Explorer</h1>

      {Object.entries(data).map(([key, value]) => (
        <div key={key} style={{ marginBottom: 30 }}>
          <h2>📦 {key}</h2>

          <pre
            style={{
              background: "#111",
              color: "#0f0",
              padding: 15,
              overflow: "auto",
              borderRadius: 8,
            }}
          >
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}