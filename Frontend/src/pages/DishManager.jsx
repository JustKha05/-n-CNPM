// src/pages/DishManager.jsx

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export default function DishManager() {
  const navigate = useNavigate();

  // === State ===
  const [dishes, setDishes] = useState([]);
  const [foods, setFoods] = useState([]);
  const [selectedDish, setSelectedDish] = useState(null);

  // Form state
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [ingredients, setIngredients] = useState([{ foodId: "", quantity: "" }]);
  const [editingDishID, setEditingDishID] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  // === Dữ liệu đã nhóm ===
  const groupedFoods = useMemo(() => {
    const groups = {};
    foods.forEach(food => {
      const categoryKey = food.Category || "Chưa phân loại";
      if (!groups[categoryKey]) groups[categoryKey] = [];
      groups[categoryKey].push(food);
    });
    return Object.entries(groups).sort((a, b) => {
        if (a[0] === "Chưa phân loại") return 1;
        if (b[0] === "Chưa phân loại") return -1;
        return a[0].localeCompare(b[0]);
    });
  }, [foods]);

  // === API Calls và Event Handlers ===

  const loadDishes = useCallback(async () => {
    try {
      const res = await fetch("/api/dishes", { credentials: "include" });
      if (!res.ok) throw new Error("Lỗi tải danh sách món ăn");
      setDishes(await res.json());
    } catch (err) {
      console.error("loadDishes ERROR:", err);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      await Promise.all([
        (async () => {
          const res = await fetch("/user-info", { credentials: "include" });
          if (!res.ok) throw new Error("Unauthorized");
        })(),
        (async () => {
          const res = await fetch("/foods", { credentials: "include" });
          if (!res.ok) throw new Error("Lỗi tải thực phẩm");
          setFoods(await res.json());
        })(),
        loadDishes()
      ]);
    } catch (err) {
      if (err.message === "Unauthorized") navigate("/login");
      else console.error("Lỗi tải dữ liệu:", err);
    }
  }, [navigate, loadDishes]);

  const showDetail = (dish) => {
    setSelectedDish(dish);
    setEditingDishID(null);
  };

  const startEdit = (dish) => {
    setErrorMsg("");
    setSelectedDish(null);
    setEditingDishID(dish.DishID);
    setDishName(dish.Name);
    setDishDescription(dish.Description || "");
    
    // Luôn reset về trạng thái loading ban đầu
    setIngredients([{ foodId: "", quantity: "" }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Gọi API để lấy thông tin chi tiết của món ăn, bao gồm cả FoodID
    fetch(`/api/dishes/${dish.DishID}`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error("Không thể tải chi tiết món ăn để sửa.");
        return res.json();
      })
      .then(fullDishData => {
        if (fullDishData.Ingredients && fullDishData.Ingredients.length > 0) {
          // Map dữ liệu đầy đủ (có FoodID) vào state
          setIngredients(fullDishData.Ingredients.map(ing => ({
            foodId: ing.FoodID, // Bây giờ chúng ta có FoodID
            quantity: String(ing.Quantity)
          })));
        } else {
          // Nếu món ăn không có nguyên liệu, vẫn để một dòng trống
          setIngredients([{ foodId: "", quantity: "" }]);
        }
      })
      .catch(err => {
        // Nếu có lỗi, hiển thị thông báo và không điền nguyên liệu
        setErrorMsg(err.message);
        setIngredients([{ foodId: "", quantity: "" }]);
      });
  };
  const cancelEdit = () => {
    setErrorMsg("");
    setEditingDishID(null);
    setDishName("");
    setDishDescription("");
    setIngredients([{ foodId: "", quantity: "" }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!dishName.trim()) {
      setErrorMsg("Tên món không được để trống.");
      return;
    }
    const filteredIngredients = ingredients
      .filter(ing => ing.foodId && ing.quantity && Number(ing.quantity) > 0)
      .map(ing => ({ FoodID: ing.foodId, Quantity: Number(ing.quantity) }));

    if (filteredIngredients.length === 0) {
      setErrorMsg("Món ăn phải có ít nhất một nguyên liệu hợp lệ.");
      return;
    }
    
    const confirmAction = editingDishID ? "lưu thay đổi cho" : "thêm món mới";
    if (!window.confirm(`Bạn có chắc muốn ${confirmAction} "${dishName.trim()}"?`)) {
        return;
    }

    const payload = {
      name: dishName.trim(),
      description: dishDescription.trim(),
      ingredients: filteredIngredients,
    };
    const isEditing = editingDishID !== null;
    const url = isEditing ? `/api/dishes/${editingDishID}` : "/api/dishes";
    const method = isEditing ? "PUT" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Lỗi không xác định");
      
      alert(data.message || (isEditing ? "Cập nhật thành công!" : "Thêm món thành công!"));
      cancelEdit(); // Reset form
      loadDishes(); // Tải lại danh sách
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa món này không? Thao tác này không thể hoàn tác.")) return;
    try {
      const res = await fetch(`/api/dishes/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      
      alert(data.message || "Xóa thành công!");
      loadDishes();
    } catch (err) {
      alert("❌ Lỗi xóa: " + err.message);
    }
  };

  const handleIngredientChange = (index, field, value) => {
    const newIngredients = [...ingredients];
    const target = newIngredients[index];
    if (field === 'quantity') {
      if (/^\d*\.?\d*$/.test(value)) target.quantity = value;
    } else {
      target.foodId = value;
    }
    setIngredients(newIngredients);
  };

  const addIngredientField = () => {
    setIngredients(prev => [...prev, { foodId: "", quantity: "" }]);
  };
  
  // HÀM removeIngredientField ĐÚNG
  const removeIngredientField = (index) => {
    // Lấy tên của nguyên liệu để hiển thị trong thông báo
    const ingredientToRemove = ingredients[index];
    const food = foods.find(f => f.FoodID.toString() === ingredientToRemove.foodId);
    const foodName = food ? `"${food.Name}"` : "nguyên liệu này";

    // Thêm hộp thoại xác nhận
    if (window.confirm(`Bạn có chắc muốn xóa nguyên liệu ${foodName} khỏi công thức?`)) {
      setIngredients((prev) => prev.filter((_, i) => i !== index));
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "auto", fontFamily: "Segoe UI, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
        <h1>🍲 Quản lý Món ăn (Công thức)</h1>
      </header>
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "300px", backgroundColor: "white", borderRadius: "8px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <h2>📋 Danh sách món</h2>
          <ul style={{ marginTop: "12px", listStyle: "none", padding: 0 }}>
            {dishes.length === 0 && <li>Chưa có món nào.</li>}
            {dishes.map((d) => (
              <li key={d.DishID} onClick={() => showDetail(d)} style={{ padding: "10px", cursor: "pointer", borderBottom: "1px solid #eee", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{d.Name}</span>
                <div>
                  <button onClick={(e) => { e.stopPropagation(); startEdit(d); }} style={{ marginLeft: "12px", backgroundColor: "#3498db", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px" }}> Sửa</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(d.DishID); }} style={{ marginLeft: "6px", backgroundColor: "#e74c3c", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px" }}> Xóa</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex: 2, minWidth: "400px" }}>
          <div style={{ marginBottom: "20px", backgroundColor: "white", borderRadius: "8px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            {selectedDish ? (
              <>
                <h2>🔍 Chi tiết: {selectedDish.Name}</h2>
                <p><strong>Mô tả:</strong> {selectedDish.Description || "Không có mô tả"}</p>
                <p><strong>Nguyên liệu:</strong></p>
                <ul>
                  {selectedDish.Ingredients?.length > 0 ? selectedDish.Ingredients.map((ing, idx) => (
                      <li key={idx}>{ing.FoodName} — Số lượng: {ing.Quantity}</li>
                    )) : <li>Không có nguyên liệu</li>}
                </ul>
              </>
            ) : <p>Chọn một món trong danh sách để xem chi tiết.</p>}
          </div>
          <div style={{ backgroundColor: "white", borderRadius: "8px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", borderTop: editingDishID ? '4px solid #f39c12' : '4px solid #2ecc71' }}>
            <h2 style={{ marginTop: 0, color: editingDishID ? '#f39c12' : '#2ecc71' }}>{editingDishID ? "✏️ Chỉnh sửa món" : "➕ Thêm món mới"}</h2>
            <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {errorMsg && <p style={{ backgroundColor: '#fdecea', color: '#c0392b', padding: '10px', borderRadius: '5px' }}>{errorMsg}</p>}
              <div>
                <label>Tên món:</label>
                <input type="text" placeholder="VD: Bò xào lúc lắc" value={dishName} onChange={(e) => setDishName(e.target.value)} required style={{ width: "100%", marginTop: "4px", padding: "8px", boxSizing: 'border-box' }}/>
              </div>
              <div>
                <label>Mô tả:</label>
                <textarea placeholder="Nhập mô tả (tuỳ ý)" value={dishDescription} onChange={(e) => setDishDescription(e.target.value)} rows={3} style={{ width: "100%", marginTop: "4px", padding: "8px", boxSizing: 'border-box' }} />
              </div>
              <div>
                <label>Nguyên liệu:</label>
                {ingredients.map((ing, idx) => (
                  <div key={idx} style={{ display: "flex", marginTop: "8px", gap: "8px" }}>
                    <select value={ing.foodId} onChange={(e) => handleIngredientChange(idx, 'foodId', e.target.value)} required style={{ flex: 2, padding: "8px" }}>
                      <option value="">-- Chọn thực phẩm --</option>
                      {groupedFoods.map(([categoryName, foodsInCategory]) => (
                        <optgroup key={categoryName} label={categoryName}>
                          {foodsInCategory.map(food => <option key={food.FoodID} value={food.FoodID}>{food.Name} ({food.Unit})</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <input type="number" placeholder="Số lượng" min="0.1" step="any" value={ing.quantity} onChange={(e) => handleIngredientChange(idx, 'quantity', e.target.value)} required style={{ flex: 1, padding: "8px" }}/>
                    {ingredients.length > 1 && (<button type="button" onClick={() => removeIngredientField(idx)} style={{ backgroundColor: "#e74c3c", color: "white", padding: "6px", border: "none", borderRadius: "4px" }}>Xóa</button>)}
                  </div>
                ))}
                <button type="button" onClick={addIngredientField} style={{ marginTop: "8px", backgroundColor: "#27ae60", color: "white", padding: "8px", border: "none", borderRadius: "4px" }}>➕ Thêm nguyên liệu</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: '10px' }}>
                <button type="submit" style={{ width: "100%", padding: "10px", backgroundColor: "#3498db", color: "white", border: "none", borderRadius: "5px" }}>{editingDishID ? "Lưu thay đổi" : "Thêm món"}</button>
                {editingDishID && (<button type="button" onClick={cancelEdit} style={{ width: "100%", padding: "10px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "5px" }}>Hủy</button>)}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}