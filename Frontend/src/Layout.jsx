// src/Layout.jsx

import React from "react";
import { NavLink, useNavigate } from "react-router-dom";

export default function Layout({ children }) {
  const navigate = useNavigate();

  // Logout → gọi backend /logout rồi redirect về /login
  async function handleLogout() {
    try {
      await fetch("/logout", { method: "GET", credentials: "include" });
      navigate("/login");
    } catch (err) {
      console.error("Logout ERROR:", err);
      alert("Lỗi khi đăng xuất");
    }
  }

  return (
    <div className="app-layout">
      {/* ===== SIDEBAR ===== */}
      <aside className="sidebar">
        <div className="logo">Menu</div>
        <nav>
          <NavLink to="/home" className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="icon">🏠</span> Trang chủ
          </NavLink>
          <NavLink to="/foods" className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="icon">🥦</span> Quản lý Thực phẩm
          </NavLink>
          <NavLink to="/dishes" className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="icon">🍜</span> Quản lý Món ăn
          </NavLink>
          <NavLink to="/mealplan" className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="icon">📅</span> Kế hoạch Ăn
          </NavLink>
          <NavLink to="/shopping" className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="icon">🛒</span> Mua sắm
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="icon">📊</span> Thống kê
          </NavLink>
        </nav>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <span className="toggle-btn">☰</span>
            {/* Tiêu đề động: có thể để trống hoặc thay bằng logo */}
          </div>
          <div className="header-right">
            <button className="btn btn-logout" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </header>

        <div className="content-area">{children}</div>
      </div>
    </div>
  );
}
