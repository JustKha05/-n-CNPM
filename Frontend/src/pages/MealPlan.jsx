// src/pages/MealPlan.jsx

import React, { useEffect, useState, useMemo } from "react"; // Thêm useMemo
import { useNavigate } from "react-router-dom";

export default function MealPlan() {
  const navigate = useNavigate();

  // === 1. State chính ===
  const [foods, setFoods] = useState([]);

  // ... các state khác giữ nguyên ...
  const [mealPlan, setMealPlan] = useState({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] });
  const [tempSelection, setTempSelection] = useState({ Monday: "", Tuesday: "", Wednesday: "", Thursday: "", Friday: "", Saturday: "", Sunday: "" });
  const [tempQuantity, setTempQuantity] = useState({ Monday: "1", Tuesday: "1", Wednesday: "1", Thursday: "1", Friday: "1", Saturday: "1", Sunday: "1" });
  const [dishSuggestions, setDishSuggestions] = useState([]);
  const [selectedDayForDish, setSelectedDayForDish] = useState("Monday");


  // =================================================================
  // === TÍNH TOÁN DỮ LIỆU ĐÃ ĐƯỢC NHÓM LẠI BẰNG useMemo ===
  // =================================================================
  const groupedFoods = useMemo(() => {
    const groups = {};
    foods.forEach(food => {
      const categoryKey = food.Category || "Chưa phân loại";
      if (!groups[categoryKey]) {
        groups[categoryKey] = [];
      }
      groups[categoryKey].push(food);
    });
    return Object.entries(groups).sort((a, b) => {
        if (a[0] === "Chưa phân loại") return 1;
        if (b[0] === "Chưa phân loại") return -1;
        return a[0].localeCompare(b[0]);
    });
  }, [foods]);

  const weekdays = [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" ];

  // ... các hàm xử lý khác giữ nguyên ...
  async function fetchUserInfo() {
    try {
      const res = await fetch("/user-info", { credentials: "include" });
      if (!res.ok) throw new Error();
    } catch {
      navigate("/login");
    }
  }
  async function fetchFoods() {
    try {
      const res = await fetch("/foods", { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFoods(data);
    } catch (err) {
      console.error("fetchFoods ERROR:", err);
    }
  }
  async function loadMealPlan() {
    try {
      const res = await fetch("/get-meals", { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const plan = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
      data.meals.forEach((item) => {
        if (plan[item.DayOfWeek] && !item.Eaten) {
          plan[item.DayOfWeek].push(item);
        }
      });
      setMealPlan(plan);
    } catch (err) {
      console.error("loadMealPlan ERROR:", err);
    }
  }
  function handleSelectChange(day, e) {
    setTempSelection((prev) => ({ ...prev, [day]: e.target.value }));
    setTempQuantity((prev) => ({ ...prev, [day]: "1" }));
  }
  function handleQuantityChange(day, e) {
    const val = e.target.value;
    if (val === "" || /^[0-9]+$/.test(val)) {
      setTempQuantity((prev) => ({ ...prev, [day]: val }));
    }
  }
  async function handleSaveDay(day) {
    const foodId = tempSelection[day];
    const qtyStr = tempQuantity[day];
    const qtyNum = Number(qtyStr);

    if (!foodId || qtyStr.trim() === "" || isNaN(qtyNum) || qtyNum <= 0) {
      alert("Vui lòng nhập số lượng hợp lệ (≥ 1)!");
      return;
    }

    const foodName = foods.find(f => f.FoodID.toString() === foodId)?.Name || "thực phẩm này";
    if (!window.confirm(`Bạn có chắc muốn thêm "${qtyNum} ${foodName}" vào kế hoạch cho ngày ${day}?`)) {
        return;
    }
    try {
      const res = await fetch("/add-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          foodId: foodId,
          quantity: qtyNum,
          dayOfWeek: day,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTempSelection((prev) => ({ ...prev, [day]: "" }));
        setTempQuantity((prev) => ({ ...prev, [day]: "1" }));
        loadMealPlan();
      } else {
        alert("❌ " + (data.error || data.message || "Lỗi khi thêm thực đơn"));
      }
    } catch (err) {
      console.error("handleSaveDay ERROR:", err);
      alert("❌ Lỗi khi kết nối máy chủ");
    }
  }
  async function handleDeleteMeal(idMealPlan) {
    if (!window.confirm("Bạn có chắc muốn xóa thực phẩm này khỏi kế hoạch ăn uống?")) return;
    try {
      const res = await fetch("/delete-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mealId: idMealPlan }),
      });
      const data = await res.json();
      if (res.ok) {
        loadMealPlan();
      } else {
        alert("❌ " + (data.error || data.message));
      }
    } catch (err) {
      console.error("handleDeleteMeal ERROR:", err);
      alert("❌ Lỗi khi xóa thực đơn");
    }
  }
  async function handleToggleEaten(idMealPlan, currentStatus, foodName) {
    if (currentStatus) return;

    if (!window.confirm(`Xác nhận đã ăn "${foodName}"? Hành động này sẽ ghi nhận vào thống kê và trừ kho.`)) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const newEaten = true;
    setMealPlan(prevPlan => {
      const newPlan = { ...prevPlan };
      for (const day in newPlan) {
        newPlan[day] = newPlan[day].filter(item => item.ID !== idMealPlan);
      }
      return newPlan;
    });
    try {
      const res = await fetch("/update-eaten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mealId: idMealPlan, eaten: newEaten, date: today }),
      });
      if (!res.ok) {
        const result = await res.json();
        alert("❌ Lỗi từ server: " + (result.error || result.message));
        loadMealPlan();
        return;
      }
      window.dispatchEvent(new Event("dataChanged"));
      const bc = new BroadcastChannel("stats-updates");
      bc.postMessage("meal-eaten-updated");
      bc.close();
    } catch (err) {
      console.error("handleToggleEaten ERROR:", err);
      alert("❌ Lỗi mạng khi cập nhật trạng thái ăn. Đang tải lại...");
      loadMealPlan();
    }
  }
  async function handleDishSuggest(dishId, day) {
    try {
      const res = await fetch("/suggest-dishes", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setDishSuggestions(data);
      } else {
        alert("❌ " + (data.error || "Lỗi khi lấy gợi ý món"));
      }
    } catch (err) {
      console.error("handleDishSuggest ERROR:", err);
      alert("❌ Lỗi khi kết nối máy chủ");
    }
  }
  async function handleAddSuggestedDish(dishId, day) {
    const dishName = dishSuggestions.find(d => d.DishID === dishId)?.Name || "món ăn này";
    if (!window.confirm(`Bạn có chắc muốn thêm món "${dishName}" vào kế hoạch cho ngày ${day}?`)) {
        return;
    }
    try {
      const res = await fetch("/add-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dishId: dishId, dayOfWeek: day }),
      });
      const data = await res.json();
      if (res.ok) {
        loadMealPlan();
      } else {
        alert("❌ " + (data.error || data.message || "Lỗi khi thêm món gợi ý"));
      }
    } catch (err) {
      console.error("handleAddSuggestedDish ERROR:", err);
      alert("❌ Lỗi khi kết nối máy chủ");
    }
  }

  useEffect(() => {
    fetchUserInfo();
    fetchFoods();
    loadMealPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Segoe UI, sans-serif", maxWidth: "1000px", margin: "auto" }}>
      <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: "25px" }}>
        <h1>📅 Thực đơn hàng tuần</h1>
      </div>

      <div className="mealplan-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
        {weekdays.map((day) => (
          <div key={day} style={{ backgroundColor: "white", padding: "15px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginBottom: "12px" }}>{day}</h3>

            {/* DANH SÁCH món đã lưu */}
            {mealPlan[day].length === 0 ? (
              <p>Chưa có món nào</p>
            ) : (
              <ul style={{ marginBottom: "12px", padding: 0, listStyle: "none" }}>
                {mealPlan[day].map((item) => {
                  const totalCal = (item.Calories || 0) * (item.Quantity || 1);
                  return (
                    <li key={item.ID} style={{ marginBottom: "8px", padding: "8px", backgroundColor: "#ecf0f1", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "600" }}>{item.FoodName}</span>
                        <span style={{ color: "#e74c3c", cursor: "pointer" }} onClick={() => handleDeleteMeal(item.ID)}>Xóa</span>
                      </div>
                      <div>
                        <span>Số lượng: {item.Quantity} {item.Unit}</span>{" "}
                        — <span>Tổng calo: {totalCal} cal</span>
                      </div>
                      <div>
                        <label>
                          Đã ăn:
                          <input type="checkbox" checked={item.Eaten === 1 || item.Eaten === true} onChange={() => handleToggleEaten(item.ID, item.Eaten, item.FoodName)} style={{ marginLeft: "6px", cursor: 'pointer' }}/>
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Dropdown chọn món tạm */}
            <div style={{ marginBottom: "8px" }}>

              <select
                value={tempSelection[day]}
                onChange={(e) => handleSelectChange(day, e)}
                style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value="">-- Chọn món --</option>
                {groupedFoods.map(([categoryName, foodsInCategory]) => (
                  <optgroup key={categoryName} label={categoryName}>
                    {foodsInCategory.map(food => (
                      <option key={food.FoodID} value={food.FoodID}>
                        {food.Name} ({food.Calories} cal/{food.Unit})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Input số lượng (chỉ hiện khi đã chọn món) */}
            {tempSelection[day] && (
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input
                  type="number" placeholder="Số lượng" value={tempQuantity[day]} onChange={(e) => handleQuantityChange(day, e)}
                  style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
                <button onClick={() => handleSaveDay(day)} style={{ padding: "6px 12px", backgroundColor: "#27ae60", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                  ➕ Thêm
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ... PHẦN GỢI Ý MÓN DƯỚI CÙNG ... */}
      <div style={{ marginTop: "30px", backgroundColor: "white", borderRadius: "8px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <h2 style={{ marginBottom: "12px" }}>🍽️ Gợi ý món</h2>
        <button onClick={handleDishSuggest} style={{ backgroundColor: "#f39c12", color: "white", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", marginBottom: "12px" }}>
          📋 Gợi ý món
        </button>
        {dishSuggestions.length === 0 ? (
          <p>Chưa có gợi ý nào.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {dishSuggestions.map((dish) => (
              <li key={dish.DishID} style={{ padding: "10px 0", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 2 }}>
                  <strong>{dish.Name}</strong>
                  <p style={{ margin: "4px 0" }}>{dish.Description || "Không có mô tả"}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                  <select value={selectedDayForDish} onChange={(e) => setSelectedDayForDish(e.target.value)} style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}>
                    {weekdays.map((wd) => (
                      <option key={wd} value={wd}>{wd}</option>
                    ))}
                  </select>
                  <button onClick={() => handleAddSuggestedDish(dish.DishID, selectedDayForDish)} style={{ backgroundColor: "#2ecc71", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
                    ➕ Thêm
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}