import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import FoodManager from "./pages/FoodManager";
import DishManager from "./pages/DishManager";
import MealPlan from "./pages/MealPlan";
import Shopping from "./pages/Shopping";

import Layout from "./Layout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes (không có sidebar/header) */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Redirect "/" → "/home" */}
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* Tất cả các route bên dưới đây sẽ được bao quanh bởi Layout (có sidebar + header) */}
        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/home"
          element={
            <Layout>
              <Home />
            </Layout>
          }
        />
        <Route
          path="/foods"
          element={
            <Layout>
              <FoodManager />
            </Layout>
          }
        />
        <Route
          path="/dishes"
          element={
            <Layout>
              <DishManager />
            </Layout>
          }
        />
        <Route
          path="/mealplan"
          element={
            <Layout>
              <MealPlan />
            </Layout>
          }
        />
        <Route
          path="/shopping"
          element={
            <Layout>
              <Shopping />
            </Layout>
          }
        />

        {/* Sai URL → redirect về /login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
