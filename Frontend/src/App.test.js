// app/frontend/src/App.test.js
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders login route by default", () => {
  render(<App />);
  // Vì nội dung login chứa “Đăng nhập” nên kiểm tra phần đó
  const linkElement = screen.getByText(/Đăng nhập/i);
  expect(linkElement).toBeInTheDocument();
});
