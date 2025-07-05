// src/pages/Register.jsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState(""); // State cho thông báo thành công
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // 1. Thêm kiểm tra ở client-side
    if (!email.trim()) {
      setErrorMsg("Vui lòng nhập email");
      return;
    }
    if (!password) {
      setErrorMsg("Vui lòng nhập mật khẩu");
      return;
    }
    // Thêm các quy tắc phức tạp hơn nếu cần (ví dụ: mật khẩu phải dài hơn 6 ký tự)
    if (password.length < 6) {
        setErrorMsg("Mật khẩu phải có ít nhất 6 ký tự");
        return;
    }

    try {
      const res = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // 2. Hiển thị thông báo thành công và tự động chuyển hướng
        setSuccessMsg(data.message + " Bạn sẽ được chuyển đến trang đăng nhập sau 3 giây.");
        setEmail(""); // Xóa input sau khi thành công
        setPassword("");
        setTimeout(() => {
          navigate("/login");
        }, 3000); // Chờ 3 giây rồi chuyển trang
      } else {
        setErrorMsg(data.message || "Đăng ký thất bại!");
      }
    } catch (err) {
      setErrorMsg("Lỗi khi kết nối máy chủ!");
      console.error("REGISTER FETCH ERROR:", err);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f4f6f8",
        fontFamily: "Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "30px 20px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            marginBottom: "24px",
            color: "#2c3e50",
          }}
        >
          📝 Đăng ký
        </h2>

        {/* 3. Thêm noValidate vào form */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontWeight: "600",
                marginBottom: "6px",
                color: "#34495e",
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="Nhập email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "5px",
                boxSizing: "border-box",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3498db")}
              onBlur={(e) => (e.target.style.borderColor = "#ccc")}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontWeight: "600",
                marginBottom: "6px",
                color: "#34495e",
              }}
            >
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              placeholder="Nhập mật khẩu (ít nhất 6 ký tự)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "5px",
                boxSizing: "border-box",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3498db")}
              onBlur={(e) => (e.target.style.borderColor = "#ccc")}
            />
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#3498db",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "background-color 0.3s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#2980b9")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#3498db")
            }
          >
            Đăng ký
          </button>
        </form>

        {/* Thông báo lỗi */}
        {errorMsg && (
          <p
            style={{
              color: "#e74c3c", // Màu đỏ cho lỗi
              marginTop: "16px",
              textAlign: "center",
            }}
          >
            {errorMsg}
          </p>
        )}

        {/* Thông báo thành công */}
        {successMsg && (
          <p
            style={{
              color: "#2ecc71", // Màu xanh cho thành công
              marginTop: "16px",
              textAlign: "center",
            }}
          >
            {successMsg}
          </p>
        )}

        <p
          style={{
            textAlign: "center",
            marginTop: "24px",
            fontSize: "14px",
            color: "#7f8c8d",
          }}
        >
          Đã có tài khoản?{" "}
          <span
            style={{
              color: "#3498db",
              cursor: "pointer",
              fontWeight: "600",
            }}
            onClick={() => navigate("/login")}
          >
            Đăng nhập
          </span>
        </p>
      </div>
    </div>
  );
}