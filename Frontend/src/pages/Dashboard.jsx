// src/pages/Dashboard.jsx

import React, { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";

export default function Dashboard() {
  const location = useLocation();
  const [todayStat, setTodayStat] = useState({
    totalSpending: 0,
    totalConsumedQuantity: 0, // Đổi tên để rõ nghĩa hơn
    totalConsumedCalories: 0, // Đổi tên để rõ nghĩa hơn
  });
  const [history, setHistory] = useState([]);
  
  const [foodSummary, setFoodSummary] = useState([]);
  const [summaryDays, setSummaryDays] = useState(30);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/daily?days=1", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch today's stats");
      const [data] = await res.json();
      if (data) {
        setTodayStat({
          totalSpending: data.totalSpending,
          // Sử dụng dữ liệu từ API (đã được tính từ userfood/log)
          totalConsumedQuantity: data.totalQuantity, 
          totalConsumedCalories: data.totalCalories,
        });
      }
    } catch (err) {
      console.error("fetchToday ERROR:", err);
      setError("Không thể tải số liệu hôm nay");
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/daily?days=7", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("fetchHistory ERROR:", err);
      setError("Không thể tải lịch sử 7 ngày");
    }
  }, []);

  const fetchFoodSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/stats/by-food?days=${summaryDays}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch food summary");
      const data = await res.json();
      data.sort((a, b) => b.totalQuantity - a.totalQuantity);
      setFoodSummary(data);
    } catch (err) {
      console.error("fetchFoodSummary ERROR:", err);
      setError("Không thể tải thống kê chi tiết");
    }
  }, [summaryDays]);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    await Promise.all([fetchToday(), fetchHistory(), fetchFoodSummary()]);
    setLoading(false);
  }, [fetchToday, fetchHistory, fetchFoodSummary]);

  useEffect(() => {
    reloadAll();

    const onDataChanged = () => {
      reloadAll();
    };
    window.addEventListener("dataChanged", onDataChanged);

    const bc = new BroadcastChannel("stats-updates");
    bc.onmessage = () => {
      reloadAll();
    };

    return () => {
      window.removeEventListener("dataChanged", onDataChanged);
      bc.close();
    };
  }, [reloadAll, location.pathname]);

  const todayLabel = new Date().toISOString().slice(0, 10);

  return (
    <div>
      {/* THAY ĐỔI TIÊU ĐỀ CHUNG */}
      <h2>Báo cáo chi tiêu & tiêu thụ ngày {todayLabel}</h2>

      {loading && <p style={{ fontStyle: "italic" }}>Đang tải...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        <>
          {/* === CARDS HIỂN THỊ HÔM NAY - CẬP NHẬT TÊN GỌI === */}
          <div
            className="dashboard-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "20px",
              marginBottom: "30px",
            }}
          >
            <div className="card">
              <div className="card-header">💰 Chi tiêu hôm nay</div>
              <div style={{ padding: 16, fontSize: "1.2rem", fontWeight: "bold" }}>
                {todayStat.totalSpending.toLocaleString()}₫
              </div>
            </div>
            <div className="card">
              {/* Đổi tên card */}
              <div className="card-header">🍽️ Lượng đã ăn hôm nay</div>
              <div style={{ padding: 16, fontSize: "1.2rem", fontWeight: "bold" }}>
                {todayStat.totalConsumedQuantity.toLocaleString()}
              </div>
            </div>
            <div className="card">
              {/* Đổi tên card */}
              <div className="card-header">🔥 Calo đã nạp hôm nay</div>
              <div style={{ padding: 16, fontSize: "1.2rem", fontWeight: "bold" }}>
                {todayStat.totalConsumedCalories.toLocaleString()}
              </div>
            </div>
          </div>

          {/* === BẢNG LỊCH SỬ 7 NGÀY - CẬP NHẬT TÊN CỘT === */}
          <h3 style={{ marginBottom: 12 }}>📊 Lịch sử 7 ngày gần nhất</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8 }}>Ngày</th>
                <th style={{ textAlign: "right", padding: 8 }}>Chi tiêu (đ)</th>
                {/* Đổi tên cột */}
                <th style={{ textAlign: "right", padding: 8 }}>Lượng đã ăn</th>
                <th style={{ textAlign: "right", padding: 8 }}>Calo đã nạp</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.date}>
                  <td style={{ padding: 8 }}>{r.date}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{r.totalSpending.toLocaleString()}</td>
                  {/* Dùng đúng dữ liệu từ API */}
                  <td style={{ padding: 8, textAlign: "right" }}>{r.totalQuantity.toLocaleString()}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{r.totalCalories.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* === BẢNG THỐNG KÊ CHI TIẾT - CẬP NHẬT TÊN GỌI === */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            {/* Đổi tên tiêu đề */}
            <h3>📈 Thống kê tiêu thụ chi tiết</h3>
            <select
              value={summaryDays}
              onChange={e => setSummaryDays(Number(e.target.value))}
              style={{ padding: '6px', borderRadius: '4px' }}
            >
              <option value="7">7 ngày qua</option>
              <option value="30">30 ngày qua</option>
              <option value="90">90 ngày qua</option>
            </select>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8 }}>Tên thực phẩm</th>
                {/* Đổi tên cột */}
                <th style={{ textAlign: "right", padding: 8 }}>Tổng lượng đã ăn</th>
                <th style={{ textAlign: "right", padding: 8 }}>Tổng Calo đã nạp</th>
                <th style={{ textAlign: "right", padding: 8 }}>Tổng chi tiêu (đ)</th>
              </tr>
            </thead>
            <tbody>
              {foodSummary.length > 0 ? (
                foodSummary.map((item) => (
                  <tr key={item.name}>
                    <td style={{ padding: 8, fontWeight: '500' }}>{item.name}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{item.totalQuantity.toLocaleString()}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{Math.round(item.totalCalories).toLocaleString()}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{item.totalSpending.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ padding: '16px', textAlign: 'center', fontStyle: 'italic' }}>
                    Không có dữ liệu tiêu thụ trong khoảng thời gian này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}