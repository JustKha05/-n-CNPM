// src/pages/Home.jsx

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  // ------- STATE -------
  const [foodsAvailable, setFoodsAvailable] = useState([]);
  const [userFoods, setUserFoods] = useState([]);

  // State cho form
  const [selectedFoodID, setSelectedFoodID] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [dateAdded, setDateAdded] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Dữ liệu đã nhóm cho dropdown
  const groupedFoodsAvailable = useMemo(() => {
    const groups = {};
    foodsAvailable.forEach(food => {
      const categoryKey = food.Category || "Chưa phân loại";
      if (!groups[categoryKey]) groups[categoryKey] = [];
      groups[categoryKey].push(food);
    });
    return Object.entries(groups).sort((a, b) => {
        if (a[0] === "Chưa phân loại") return 1;
        if (b[0] === "Chưa phân loại") return -1;
        return a[0].localeCompare(b[0]);
    });
  }, [foodsAvailable]);


  // =========================================================
  // === API CALLS ĐƯỢC BỌC TRONG useCallback ===
  // =========================================================

  const fetchUserInfo = useCallback(async () => {
    try {
      const res = await fetch("/me", { credentials: "include" });
      if (!res.ok) throw new Error("Chưa đăng nhập");
    } catch (err) {
      navigate("/login");
    }
  }, [navigate]);

  const fetchFoods = useCallback(async () => {
    try {
      const res = await fetch("/foods", { credentials: "include" });
      if (!res.ok) throw new Error("Không lấy được danh sách foods");
      const data = await res.json();
      setFoodsAvailable(data);
    } catch (err) {
      console.error("fetchFoods ERROR:", err);
    }
  }, []);

  const loadUserFoods = useCallback(async () => {
    try {
      const res = await fetch("/user-foods", { credentials: "include" });
      if (!res.ok) throw new Error("Không lấy được kho");
      const data = await res.json();
      setUserFoods(data);
    } catch (err) {
      console.error("loadUserFoods ERROR:", err);
    }
  }, []);


  // =========================================================
  // === EVENT HANDLERS ===
  // =========================================================

  const handleAddFood = useCallback(async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const qtyNum = parseFloat(quantity);
    if (!selectedFoodID) {
      setErrorMsg("Vui lòng chọn một loại thực phẩm.");
      return;
    }
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setErrorMsg("Số lượng phải là một số lớn hơn 0.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const finalDate = dateAdded || today;

    try {
      const res = await fetch("/add-to-userfood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          foodId: selectedFoodID,
          quantity: qtyNum,
          date: finalDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi server");

      alert(data.message);
      setSelectedFoodID("");
      setQuantity("1");
      setDateAdded("");
      loadUserFoods();
      window.dispatchEvent(new Event("dataChanged"));
    } catch (err) {
      setErrorMsg("❌ " + err.message);
    }
  }, [selectedFoodID, quantity, dateAdded, loadUserFoods]);

  const handleDeleteUserFood = useCallback(async (id, foodName) => {
    if (!window.confirm(`Bạn có chắc muốn xóa lô hàng "${foodName}" này không?`)) return;
    try {
      const res = await fetch("/delete-user-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      
      alert(text);
      loadUserFoods();
      window.dispatchEvent(new Event("dataChanged"));
    } catch (err) {
      alert("❌ " + err.message);
    }
  }, [loadUserFoods]);


  // =========================================================
  // === useEffect KHỞI TẠO ===
  // =========================================================
  useEffect(() => {
    fetchUserInfo();
    fetchFoods();
    loadUserFoods();
  }, [fetchUserInfo, fetchFoods, loadUserFoods]);


  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "auto", fontFamily: "Segoe UI, sans-serif" }}>
      <h1 style={{ textAlign: "center", marginBottom: "30px" }}>📦 Kho thực phẩm</h1>
      
      <form onSubmit={handleAddFood} noValidate style={{ backgroundColor: "#fff", borderRadius: "8px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "25px" }}>
        <h2 style={{marginTop: 0}}>Thêm thực phẩm vào kho</h2>
        
        {errorMsg && (
          <p style={{ backgroundColor: '#fdecea', color: '#c0392b', padding: '10px', borderRadius: '5px', border: '1px solid #e74c3c' }}>
            {errorMsg}
          </p>
        )}

        <label htmlFor="foodSelect" style={{ fontWeight: "600" }}>Chọn thực phẩm có sẵn:</label>
        <select 
            id="foodSelect" 
            value={selectedFoodID} 
            onChange={(e) => setSelectedFoodID(e.target.value)} 
            required 
            style={{ width: "100%", padding: "10px", marginTop: "6px", marginBottom: "15px", border: "1px solid #ccc", borderRadius: "5px" }}
        >
          <option value="">-- Chọn thực phẩm --</option>
          {groupedFoodsAvailable.map(([categoryName, foodsInCategory]) => (
            <optgroup key={categoryName} label={categoryName}>
              {foodsInCategory.map(food => (
                <option key={food.FoodID} value={food.FoodID}>{food.Name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        
        <label htmlFor="quantity" style={{ fontWeight: "600" }}>Số lượng:</label>
        <input 
            id="quantity"
            type="number" 
            placeholder="Số lượng" 
            min="0.01" 
            step="any" 
            required 
            value={quantity} 
            onChange={(e) => setQuantity(e.target.value)} 
            style={{ width: "100%", padding: "10px", marginTop: "6px", marginBottom: "15px", border: "1px solid #ccc", borderRadius: "5px", boxSizing: "border-box" }} 
        />
        
        <label htmlFor="dateAdded" style={{ fontWeight: "600" }}>Ngày nhập:</label>
        <input 
            id="dateAdded"
            type="date" 
            value={dateAdded} 
            onChange={(e) => setDateAdded(e.target.value)} 
            style={{ width: "100%", padding: "10px", marginTop: "6px", marginBottom: "15px", border: "1px solid #ccc", borderRadius: "5px", boxSizing: "border-box" }} 
        />

        <button type="submit" style={{ width: "100%", padding: "12px", backgroundColor: "#3498db", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", fontSize: '1rem' }}>
          ✔️ Thêm vào kho
        </button>
      </form>

      <section className="card" style={{ backgroundColor: "#fff", borderRadius: "8px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <h2 style={{ marginBottom: "15px" }}>Thực phẩm hiện có trong kho</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {userFoods.length === 0 ? (
            <li>Kho của bạn đang trống.</li>
          ) : (
            userFoods.map((food) => {
              const isExpired = food.ExpirationDate && new Date() > new Date(food.ExpirationDate);
              return (
                <li key={food.id} style={{ background: isExpired ? "#fdecea" : "#ecf0f1", marginBottom: "10px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "5px" }}>
                  <div style={{ flexGrow: 1, marginRight: "10px" }}>
                    <div><strong>{food.Name}</strong></div>
                    <div>Số lượng: <strong>{Number(food.Quantity).toFixed(2)}</strong> {food.Unit}</div>
                    <div>Ngày nhập: <em>{new Date(food.DateAdded).toLocaleDateString()}</em></div>
                    <div style={{ color: isExpired ? "#c0392b" : "#2c3e50" }}>
                      HSD: <em>{food.ExpirationDate ? new Date(food.ExpirationDate).toLocaleDateString() : "Không có"}</em>
                      {isExpired && " (Đã hết hạn)"}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteUserFood(food.id, food.Name)} style={{ background: "#e74c3c", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
                    Xóa
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}