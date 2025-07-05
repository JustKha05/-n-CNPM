// src/pages/Shopping.jsx

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export default function Shopping() {
  const navigate = useNavigate();

  // --- STATE ---
  const [foods, setFoods] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedFoodID, setSelectedFoodID] = useState("");
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingQuantity, setEditingQuantity] = useState("");
  const [editingUnitPrice, setEditingUnitPrice] = useState("");

  // --- DỮ LIỆU ĐÃ NHÓM ---
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

  // --- API CALLS & EVENT HANDLERS ---
  
  const loadFoods = useCallback(async () => {
    try {
      const res = await fetch("/foods", { credentials: "include" });
      if (!res.ok) throw new Error("Lỗi tải thực phẩm");
      setFoods(await res.json());
    } catch (err) {
      console.error("loadFoods ERROR:", err);
    }
  }, []);

  const loadShoppingList = useCallback(async () => {
    try {
      const res = await fetch("/shopping-list", { credentials: "include" });
      if (!res.ok) throw new Error("Lỗi tải giỏ hàng");
      setShoppingList(await res.json());
    } catch (err) {
      console.error("loadShoppingList ERROR:", err);
    }
  }, []);
  
  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/user-info", { credentials: "include" });
      if (!res.ok) throw new Error("Unauthorized");
      
      await Promise.all([
        loadFoods(),
        loadShoppingList()
      ]);
    } catch (err) {
      if (err.message === "Unauthorized") navigate("/login");
      else console.error("Lỗi tải dữ liệu:", err);
    }
  }, [navigate, loadFoods, loadShoppingList]);

  const handleFoodChange = (e) => {
    const fid = e.target.value;
    setSelectedFoodID(fid);
    const f = foods.find((x) => +x.FoodID === +fid);
    if (f) {
      setUnit(f.Unit || "");
      setUnitPrice(f.Price !== null ? String(f.Price) : ""); 
    } else {
      setUnit("");
      setUnitPrice("");
    }
  };

  const handleAddShopping = async (e) => {
    e.preventDefault();
    const qtyNum = Number(quantity);
    const priceNum = unitPrice.trim() === "" ? 0 : Number(unitPrice); 

    if (!selectedFoodID || isNaN(qtyNum) || qtyNum <= 0 || isNaN(priceNum) || priceNum < 0) {
      alert("Vui lòng chọn món, nhập số lượng (>0) và giá đơn vị (≥0)");
      return;
    }

    const foodName = foods.find(f => f.FoodID.toString() === selectedFoodID)?.Name || "món này";
    if (!window.confirm(`Thêm "${qtyNum} ${unit || ''} ${foodName}" vào giỏ hàng?`)) return;

    try {
      const res = await fetch("/add-shopping", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ foodId: selectedFoodID, quantity: qtyNum, unitPrice: priceNum }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      
      setQuantity("1");
      setUnitPrice("");
      setSelectedFoodID("");
      loadFoods(); 
      loadShoppingList();
    } catch (err) {
      alert("❌ " + err.message);
    }
  };

  const handleDeleteShopping = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa món này khỏi giỏ hàng?")) return;
    try {
      const res = await fetch("/delete-shopping", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      loadShoppingList();
    } catch (err) {
      alert("❌ " + err.message);
    }
  };

  const handleSuggest = async () => {
    try {
      const res = await fetch("/suggest-shopping-quantity", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi lấy gợi ý");
      setSuggestions(data);
    } catch (err) {
      alert("❌ " + err.message);
    }
  };
  
  const applySuggestion = async (item) => {
    const priceNum = item.Price || 0;
    try {
      const res = await fetch("/add-shopping", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ foodId: item.FoodID, quantity: item.NeedQuantity, unitPrice: priceNum }) });
      if (!res.ok) throw new Error('Lỗi khi thêm từ gợi ý');
      
      setSuggestions((prev) => prev.filter((s) => s.FoodID !== item.FoodID));
      loadShoppingList();
    } catch (err) {
      alert("❌ " + err.message);
    }
  };

  const handleMarkPurchased = async (item) => {
    if (!window.confirm(`Đã mua ${item.Name} với số lượng ${item.Quantity}?`)) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/mark-purchased", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id: item.ID, date: today }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      
      await loadShoppingList();
      window.dispatchEvent(new Event("dataChanged"));
    } catch (err) {
      alert("❌ Lỗi khi đánh dấu đã mua: " + err.message);
    }
  };

  const startEditing = (item) => {
    setEditingItemId(item.ID);
    setEditingQuantity(String(item.Quantity));
    setEditingUnitPrice(String(item.UnitPrice));
  };

  const cancelEditing = () => {
    setEditingItemId(null);
  };

  const handleUpdateShoppingItem = async (id) => {
    const qty = parseFloat(editingQuantity);
    const price = parseFloat(editingUnitPrice);

    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      alert("Vui lòng nhập số lượng và giá hợp lệ.");
      return;
    }
    if (!window.confirm("Bạn có chắc muốn lưu thay đổi này?")) return;
    
    try {
      const res = await fetch(`/update-shopping-item/${id}`, {
        method: 'PUT',
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantity: qty, unitPrice: price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi cập nhật");

      alert(data.message);
      cancelEditing();
      loadShoppingList();
    } catch (err) {
      alert("❌ " + err.message);
    }
  }

  const getTotalMoney = () => shoppingList.reduce((sum, item) => sum + (item.TotalPrice || 0), 0);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div style={{ padding: "20px", fontFamily: "Segoe UI, sans-serif", maxWidth: "800px", margin: "auto" }}>
      <header style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: "25px" }}>
        <h1>🛒 Danh sách mua sắm</h1>
      </header>

      <div className="card" style={{ backgroundColor: "white", borderRadius: "8px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
        <h2 style={{ marginBottom: "12px" }}>➕ Thêm vào danh sách</h2>
        <form onSubmit={handleAddShopping} noValidate style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label>Chọn thực phẩm mua:</label>
            <select value={selectedFoodID} onChange={handleFoodChange} required style={{ width: "100%", marginTop: "4px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}>
              <option value="">-- Chọn thực phẩm --</option>
              {groupedFoods.map(([categoryName, foodsInCategory]) => (
                <optgroup key={categoryName} label={categoryName}>
                  {foodsInCategory.map(food => <option key={food.FoodID} value={food.FoodID}>{food.Name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label>Số lượng:</label>
              <input type="number" placeholder="Số lượng" min="0.1" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required style={{ width: "100%", marginTop: "4px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Giá đơn vị ({unit}):</label>
              <input type="number" placeholder="Giá/đơn vị" min="0" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required style={{ width: "100%", marginTop: "4px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }} />
            </div>
          </div>
          <button type="submit" style={{ width: "100%", padding: "10px", backgroundColor: "#3498db", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: 'bold' }}>Thêm vào giỏ</button>
          <div style={{ textAlign: "right", marginTop: "10px" }}>
            <button onClick={handleSuggest} type="button" style={{ backgroundColor: "#f39c12", color: "white", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: "pointer" }}>📝 Gợi ý mua</button>
          </div>
        </form>
      </div>

      {suggestions.length > 0 && (
        <div className="card" style={{ backgroundColor: "#fff5e6", borderRadius: "8px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
          <h3 style={{ marginBottom: "8px", color: "#d35400" }}>Danh sách cần mua</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {suggestions.map((item) => (
              <li key={item.FoodID} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span><strong>{item.Name}</strong> — Cần thêm: {item.NeedQuantity}</span>
                <button onClick={() => applySuggestion(item)} style={{ backgroundColor: "#2ecc71", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px" }}>➕ Thêm</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card" style={{ backgroundColor: "white", borderRadius: "8px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <h2 style={{ marginBottom: "12px" }}>Giỏ hàng ({shoppingList.length})</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {shoppingList.length === 0 && <li>Chưa có gì trong giỏ.</li>}
          {shoppingList.map((item) => (
            <li key={item.ID} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
              {editingItemId === item.ID ? (
                <div>
                  <strong style={{display: 'block', marginBottom: '8px'}}>{item.Name}</strong>
                  <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <input type="number" value={editingQuantity} onChange={e => setEditingQuantity(e.target.value)} style={{width: '80px', padding: '6px'}} min="0.1" step="any"/>
                    <span>x</span>
                    <input type="number" value={editingUnitPrice} onChange={e => setEditingUnitPrice(e.target.value)} style={{width: '100px', padding: '6px'}} min="0" step="any"/>
                    <span>đ</span>
                    <div style={{marginLeft: 'auto'}}>
                      <button onClick={() => handleUpdateShoppingItem(item.ID)} style={{backgroundColor: '#3498db', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', marginRight: '5px'}}>Lưu</button>
                      <button onClick={cancelEditing} style={{backgroundColor: '#7f8c8d', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px'}}>Hủy</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flexGrow: 1, marginRight: '10px' }}>
                        <span style={{ fontWeight: "600" }}>{item.Name} </span><br/>
                        <span style={{color: '#555'}}>Số lượng: {item.Quantity} {item.Unit} x {item.UnitPrice.toLocaleString()}đ</span>
                    </div>
                    <div style={{ fontWeight: 'bold', minWidth: '80px', textAlign: 'right' }}>
                        {item.TotalPrice.toLocaleString()}đ
                    </div>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginLeft: '15px' }}>
                        <button onClick={() => startEditing(item)} title="Sửa" style={{ backgroundColor: "#f39c12", color: "white", border: "none", padding: "6px 10px", borderRadius: "4px" }}>Sửa</button>
                        <button onClick={() => handleMarkPurchased(item)} title="Đã mua" style={{ backgroundColor: "#27ae60", color: "white", border: "none", padding: "6px 10px", borderRadius: "4px" }}>Đã mua</button>
                        <button onClick={() => handleDeleteShopping(item.ID)} title="Xóa" style={{ backgroundColor: "#e74c3c", color: "white", border: "none", padding: "6px 10px", borderRadius: "4px" }}>Xóa</button>
                    </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div style={{ marginTop: "16px", textAlign: "right", fontWeight: "600", fontSize: "1.1rem" }}>
          Tổng cộng: {getTotalMoney().toLocaleString()}đ
        </div>
      </div>
    </div>
  );
}