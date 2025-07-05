// src/pages/FoodManager.jsx

import React, { useEffect, useState, useMemo, useCallback } from "react"; // Thêm useCallback
import { useNavigate } from "react-router-dom";

export default function FoodManager() {
  const navigate = useNavigate();

  // === State ===
  const [editingFoodId, setEditingFoodId] = useState(null);
  const [foods, setFoods] = useState([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [calories, setCalories] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [shelfLife, setShelfLife] = useState("");
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

  // === API Calls được bọc trong useCallback ===
  const fetchUserInfo = useCallback(async () => {
    try {
      const res = await fetch("/me", { credentials: "include" });
      if (!res.ok) throw new Error("Unauthorized");
    } catch (err) {
      navigate("/login");
    }
  }, [navigate]);

  const loadFoods = useCallback(async () => {
    try {
      const res = await fetch("/foods", { credentials: "include" });
      if (!res.ok) throw new Error("Không lấy được danh sách foods");
      const data = await res.json();
      setFoods(data);
    } catch (err) {
      console.error("loadFoods ERROR:", err);
    }
  }, []);

  // === Event Handlers ===
  const handleEdit = (food) => {
    setErrorMsg("");
    setEditingFoodId(food.FoodID);
    setName(food.Name);
    setCategory(food.Category || "");
    setCalories(String(food.Calories));
    setUnit(food.Unit);
    setPrice(food.Price !== null ? String(food.Price) : "");
    setShelfLife(food.ShelfLife !== null ? String(food.ShelfLife) : "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setErrorMsg("");
    setEditingFoodId(null);
    setName("");
    setCategory("");
    setCalories("");
    setUnit("");
    setPrice("");
    setShelfLife("");
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim() || !unit.trim() || !calories.toString().trim()) {
      setErrorMsg("Hãy điền đầy đủ thông tin thực phẩm (Tên, Calories, Đơn vị).");
      return;
    }
    if (isNaN(calories) || Number(calories) <= 0) {
      setErrorMsg("Calories phải là một số lớn hơn 0.");
      return;
    }
    
    const bodyPayload = {
      name: name.trim(),
      category: category.trim() || null,
      calories: Number(calories),
      unit: unit.trim(),
      price: price.trim() ? Number(price) : null,
      shelfLife: shelfLife.trim() ? Number(shelfLife) : 0,
    };

    const isEditing = editingFoodId !== null;
    const url = isEditing ? `/update-food/${editingFoodId}` : "/add-new-food";
    const method = isEditing ? "PUT" : "POST";

    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(bodyPayload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Đã xảy ra lỗi server");

      alert(`✅ ${data.message}`);
      cancelEdit();
      loadFoods();
    } catch (err) {
      setErrorMsg(err.message);
    }
  }, [name, category, calories, unit, price, shelfLife, editingFoodId, loadFoods]); // Phụ thuộc vào tất cả state và hàm mà nó sử dụng

  const handleDelete = useCallback(async (foodId, foodName) => {
    // 1. Kiểm tra việc sử dụng trước khi xóa
    try {
        const checkRes = await fetch(`/check-food-usage/${foodId}`, { credentials: "include" });
        if (!checkRes.ok) {
            // Nếu kiểm tra lỗi, vẫn cho phép xóa với cảnh báo chung
            if (!window.confirm(`Không thể kiểm tra việc sử dụng của thực phẩm này. Bạn vẫn muốn tiếp tục xóa "${foodName}"?`)) return;
        } else {
            const usage = await checkRes.json();
            let warningMessage = `Bạn có chắc muốn xóa "${foodName}"?\n`;
            let proceed = true;

            if (usage.isInRecipe || usage.isInMealPlan) {
                warningMessage += "\nCẢNH BÁO: Thực phẩm này đang được sử dụng trong:\n";
                if (usage.isInRecipe) {
                    warningMessage += `- Các món ăn: ${usage.dishes.join(', ')}\n`;
                }
                if (usage.isInMealPlan) {
                    warningMessage += `- Kế hoạch ăn của các ngày: ${usage.mealPlanDays.join(', ')}\n`;
                }
                warningMessage += "\nViệc xóa sẽ gỡ bỏ nó khỏi tất cả các vị trí trên. Bạn có chắc chắn muốn tiếp tục?";
                proceed = window.confirm(warningMessage);
            } else {
                proceed = window.confirm(warningMessage);
            }

            if (!proceed) return;
        }
    } catch (err) {
        // Lỗi mạng khi kiểm tra, vẫn cho phép xóa với cảnh báo
        if (!window.confirm(`Lỗi mạng khi kiểm tra. Bạn vẫn muốn tiếp tục xóa "${foodName}"?`)) return;
    }
    
    // 2. Nếu người dùng xác nhận, tiến hành xóa
    try {
      const deleteRes = await fetch("/delete-shared-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ foodId }),
      });
      const text = await deleteRes.text();
      if (!deleteRes.ok) throw new Error(text);
      
      alert(text);
      loadFoods(); // Tải lại danh sách sau khi xóa thành công
    } catch (err) {
      alert("Lỗi xóa món: " + err.message);
    }
  }, [loadFoods]);

  // === useEffect khởi tạo ===
  useEffect(() => {
    fetchUserInfo();
    loadFoods();
  }, [fetchUserInfo, loadFoods]);

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "auto", fontFamily: "Segoe UI, sans-serif", backgroundColor: "#f7f9fb", color: "#2c3e50" }}>
      <header style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: "25px" }}>
        <h1>🍱 Quản lý danh mục thực phẩm</h1>
      </header>

      <form onSubmit={handleSubmit} noValidate style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: "30px", borderTop: editingFoodId ? '4px solid #f39c12' : '4px solid #3498db' }}>
        <h2 style={{ marginTop: 0, color: editingFoodId ? '#f39c12' : '#3498db' }}>
          {editingFoodId ? '✏️ Chỉnh sửa thực phẩm' : '➕ Thêm thực phẩm mới'}
        </h2>
        
        {errorMsg && (
          <p style={{ backgroundColor: '#fdecea', color: '#c0392b', padding: '10px', borderRadius: '5px', border: '1px solid #e74c3c', margin: '0 0 15px 0' }}>
            {errorMsg}
          </p>
        )}

        <label style={{ fontWeight: "600" }}>Tên thực phẩm:</label>
        <input type="text" placeholder="Tên thực phẩm" required value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "10px", marginTop: "6px", marginBottom: "15px", width: "100%", borderRadius: "5px", border: "1px solid #ccc", boxSizing: "border-box" }} />
        
        <label style={{ fontWeight: "600" }}>Danh mục:</label>
        <input type="text" placeholder="VD: Trái cây, Rau củ" value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: "10px", marginTop: "6px", marginBottom: "15px", width: "100%", borderRadius: "5px", border: "1px solid #ccc", boxSizing: "border-box" }} />
        
        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: "600" }}>Calories:</label>
            <input type="number" placeholder="Calories" min="0" step="any" required value={calories} onChange={(e) => setCalories(e.target.value)} style={{ padding: "10px", marginTop: "6px", width: "100%", borderRadius: "5px", border: "1px solid #ccc", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: "600" }}>Đơn vị:</label>
            <input type="text" placeholder="g, ml, quả..." required value={unit} onChange={(e) => setUnit(e.target.value)} style={{ padding: "10px", marginTop: "6px", width: "100%", borderRadius: "5px", border: "1px solid #ccc", boxSizing: "border-box" }} />
          </div>
        </div>
        
        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: "600" }}>Giá (tùy chọn):</label>
            <input type="number" placeholder="Giá (tùy chọn)" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} style={{ padding: "10px", marginTop: "6px", width: "100%", borderRadius: "5px", border: "1px solid #ccc", boxSizing: "border-box" }}/>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: "600" }}>HSD (ngày):</label>
            <input type="number" placeholder="Số ngày bảo quản" min="0" value={shelfLife} onChange={(e) => setShelfLife(e.target.value)} style={{ padding: "10px", marginTop: "6px", width: "100%", borderRadius: "5px", border: "1px solid #ccc", boxSizing: "border-box" }}/>
          </div>
        </div>

        <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
            <button type="submit" style={{ flex: 1, backgroundColor: editingFoodId ? "#f39c12" : "#3498db", color: "white", padding: "12px", borderRadius: "5px", border: "none", fontWeight: "bold", cursor: "pointer", fontSize: '1rem' }}>
                {editingFoodId ? 'Lưu thay đổi' : '➕ Thêm mới'}
            </button>
            {editingFoodId && (
                <button type="button" onClick={cancelEdit} style={{ flex: 1, backgroundColor: "#7f8c8d", color: "white", padding: "12px", borderRadius: "5px", border: "none", fontWeight: "bold", cursor: "pointer", fontSize: '1rem' }}>
                    Hủy
                </button>
            )}
        </div>
      </form>

      <div className="food-list-container">
        {groupedFoods.length === 0 ? (
          <div className="card" style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", textAlign: 'center' }}>
            <p>Chưa có món nào trong danh sách.</p>
          </div>
        ) : (
          groupedFoods.map(([categoryName, foodsInCategory]) => (
            <div key={categoryName} className="card" style={{ backgroundColor: "white", borderRadius: "8px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: "25px" }}>
              <h2 style={{ marginBottom: "15px", borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>{categoryName}</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Tên</th>
                    <th style={{ textAlign: 'right', padding: '8px' }}>Calories</th>
                    <th style={{ textAlign: 'right', padding: '8px' }}>Giá</th>
                    <th style={{ textAlign: 'right', padding: '8px' }}>HSD (ngày)</th>
                    <th style={{ textAlign: 'center', padding: '8px', width: '150px' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {foodsInCategory.map((f) => (
                    <tr key={f.FoodID} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px', fontWeight: '500' }}>{f.Name} <em style={{color: '#7f8c8d', fontSize: '0.9em'}}>({f.Unit})</em></td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{f.Calories}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{f.Price !== null ? f.Price.toLocaleString() + 'đ' : 'N/A'}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{f.ShelfLife}</td>
                      <td style={{ textAlign: 'center', padding: '8px' }}>
                        <button onClick={() => handleEdit(f)} style={{ backgroundColor: "#2980b9", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", marginRight: '5px' }}>
                          Sửa
                        </button>
                        <button onClick={() => handleDelete(f.FoodID, f.Name)} style={{ backgroundColor: "#e74c3c", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}