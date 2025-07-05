DROP DATABASE IF EXISTS foodmanagement;
CREATE DATABASE foodmanagement;
USE foodmanagement;

-- Bảng người dùng
CREATE TABLE User (
    UserID INT AUTO_INCREMENT PRIMARY KEY,
    Email VARCHAR(100) NOT NULL UNIQUE,
    Password VARCHAR(255) NOT NULL
);

-- Bảng thực phẩm (có UserID, nếu NULL thì là dữ liệu mẫu)
CREATE TABLE Food (
    FoodID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT,  -- NULL = dữ liệu mẫu dùng chung; >0 = bản riêng của người dùng
    Name VARCHAR(100) NOT NULL,
    Category VARCHAR(50),
    Calories INT,
    Unit VARCHAR(20),
    Price DECIMAL(10,2),
    ShelfLife INT NOT NULL DEFAULT 0,
    FOREIGN KEY (UserID) REFERENCES User(UserID) ON DELETE CASCADE
);

-- Bảng userfood (thực phẩm người dùng sở hữu trong kho cá nhân)
CREATE TABLE userfood (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    FoodID INT NOT NULL,
    Name VARCHAR(100) NOT NULL,
    Calories INT NOT NULL,
    Quantity FLOAT NOT NULL,
    DateAdded DATE NOT NULL,
    FOREIGN KEY (UserID) REFERENCES `User`(UserID) ON DELETE CASCADE,
    FOREIGN KEY (FoodID) REFERENCES `Food`(FoodID) ON DELETE CASCADE
);




-- Bảng kế hoạch ăn
CREATE TABLE MealPlan (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  UserID INT NOT NULL,
  FoodID INT NOT NULL,
  Quantity INT NOT NULL,
  Eaten BOOLEAN DEFAULT FALSE,
  DayOfWeek ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL, 
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UserID) REFERENCES User(UserID) ON DELETE CASCADE,
  FOREIGN KEY (FoodID) REFERENCES Food(FoodID)
);

-- Danh sách mua sắm
CREATE TABLE ShoppingList (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  UserID INT NOT NULL,
  FoodID INT,                           
  Name VARCHAR(100) NOT NULL,           
  Quantity INT NOT NULL,
  UnitPrice DECIMAL(10,2) NOT NULL,     
  TotalPrice DECIMAL(10,2) NOT NULL,
  Purchased TINYINT(1) NOT NULL DEFAULT 0,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UserID) REFERENCES User(UserID) ON DELETE CASCADE,
  FOREIGN KEY (FoodID) REFERENCES Food(FoodID) ON DELETE SET NULL
);


-- Món ăn do người dùng tạo
CREATE TABLE Dish (
    DishID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT,  -- NULL = mẫu dùng chung, >0 = món riêng của người dùng
    Name VARCHAR(100) NOT NULL,
    Description TEXT,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES User(UserID) ON DELETE CASCADE
);

-- Công thức món ăn
CREATE TABLE Recipe (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    DishID INT NOT NULL,
    FoodID INT NOT NULL,
    Quantity FLOAT NOT NULL,
    FOREIGN KEY (DishID) REFERENCES Dish(DishID) ON DELETE CASCADE,
    FOREIGN KEY (FoodID) REFERENCES Food(FoodID) ON DELETE CASCADE
);

-- Nhật ký tiêu thụ thực phẩm
CREATE TABLE ConsumptionLog (
    LogID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    FoodID INT NOT NULL,
    Name VARCHAR(100) NOT NULL,
    Calories INT NOT NULL,
    Quantity FLOAT NOT NULL,
    ConsumedAt DATE NOT NULL,
    FOREIGN KEY (UserID) REFERENCES `User`(UserID) ON DELETE CASCADE,
    FOREIGN KEY (FoodID) REFERENCES `Food`(FoodID) ON DELETE CASCADE
);

-- Dữ liệu mẫu dùng chung (UserID = NULL)
USE foodmanagement;

-- Thêm khoảng 100 món vào bảng Food (UserID = NULL)
INSERT INTO Food (UserID, Name, Category, Calories, Unit, Price, ShelfLife) VALUES
(NULL, 'Táo', 'Trái cây', 52, 'quả', 1.50, 30),
(NULL, 'Chuối', 'Trái cây', 89, 'quả', 0.50, 10),
(NULL, 'Cam', 'Trái cây', 47, 'quả', 1.00, 20),
(NULL, 'Dưa hấu', 'Trái cây', 30, '100g', 0.40, 7),
(NULL, 'Dâu tây', 'Trái cây', 33, '100g', 2.00, 5),
(NULL, 'Nho', 'Trái cây', 69, '100g', 1.80, 7),
(NULL, 'Lê', 'Trái cây', 57, 'quả', 1.20, 20),
(NULL, 'Xoài', 'Trái cây', 60, '100g', 2.50, 7),
(NULL, 'Ổi', 'Trái cây', 43, '100g', 1.00, 10),
(NULL, 'Chanh', 'Trái cây', 29, 'quả', 0.75, 30),
(NULL, 'Bơ', 'Trái cây', 160, '100g', 2.20, 14),
(NULL, 'Mít', 'Trái cây', 95, '100g', 0.80, 5),
(NULL, 'Đu đủ', 'Trái cây', 43, '100g', 0.90, 7),
(NULL, 'Chôm chôm', 'Trái cây', 41, '100g', 1.50, 5),
(NULL, 'Mận', 'Trái cây', 46, '100g', 1.20, 10),
(NULL, 'Quýt', 'Trái cây', 53, 'quả', 0.60, 15),
(NULL, 'Vải thiều', 'Trái cây', 66, '100g', 2.00, 5),
(NULL, 'Ổi đào', 'Trái cây', 38, '100g', 1.10, 7),
(NULL, 'Mơ', 'Trái cây', 48, '100g', 1.30, 10),
(NULL, 'Mâm xôi', 'Trái cây', 52, '100g', 2.20, 5),

(NULL, 'Cà rốt', 'Rau củ', 41, '100g', 0.80, 14),
(NULL, 'Khoai tây', 'Rau củ', 77, '100g', 0.50, 30),
(NULL, 'Khoai lang', 'Rau củ', 86, '100g', 0.70, 14),
(NULL, 'Củ cải đường', 'Rau củ', 43, '100g', 0.90, 14),
(NULL, 'Su hào', 'Rau củ', 27, '100g', 0.75, 10),
(NULL, 'Bắp cải', 'Rau củ', 25, '100g', 0.60, 10),
(NULL, 'Rau muống', 'Rau củ', 19, '100g', 0.50, 5),
(NULL, 'Rau cải xanh', 'Rau củ', 28, '100g', 0.60, 7),
(NULL, 'Cải bó xôi', 'Rau củ', 23, '100g', 0.70, 7),
(NULL, 'Cải thảo', 'Rau củ', 13, '100g', 0.65, 7),
(NULL, 'Su su', 'Rau củ', 25, '100g', 0.55, 10),
(NULL, 'Đậu que', 'Rau củ', 31, '100g', 0.80, 7),
(NULL, 'Bông cải xanh', 'Rau củ', 34, '100g', 1.20, 7),
(NULL, 'Bắp non', 'Rau củ', 86, '100g', 1.00, 5),
(NULL, 'Rau ngót', 'Rau củ', 25, '100g', 0.50, 5),
(NULL, 'Rau cải cúc', 'Rau củ', 20, '100g', 0.75, 5),
(NULL, 'Rau dền', 'Rau củ', 25, '100g', 0.60, 5),
(NULL, 'Su hào mini', 'Rau củ', 27, '100g', 0.80, 10),
(NULL, 'Bí đỏ', 'Rau củ', 26, '100g', 0.90, 14),
(NULL, 'Bí xanh', 'Rau củ', 17, '100g', 0.85, 14),

(NULL, 'Thịt bò', 'Thịt', 250, '100g', 5.00, 7),
(NULL, 'Thịt heo', 'Thịt', 242, '100g', 3.50, 5),
(NULL, 'Thịt gà', 'Thịt', 239, '100g', 2.80, 5),
(NULL, 'Thịt vịt', 'Thịt', 240, '100g', 3.00, 5),
(NULL, 'Thịt cừu', 'Thịt', 294, '100g', 6.00, 7),
(NULL, 'Thịt dê', 'Thịt', 160, '100g', 5.50, 7),
(NULL, 'Xúc xích', 'Thịt', 301, '100g', 2.50, 14),
(NULL, 'Giò lụa', 'Thịt', 311, '100g', 2.80, 14),
(NULL, 'Giò bò', 'Thịt', 320, '100g', 3.00, 14),
(NULL, 'Thịt xông khói', 'Thịt', 541, '100g', 4.00, 14),
(NULL, 'Thịt nghé', 'Thịt', 160, '100g', 5.20, 7),
(NULL, 'Thịt gà ta', 'Thịt', 165, '100g', 3.00, 5),
(NULL, 'Gà công nghiệp', 'Thịt', 190, '100g', 2.50, 5),
(NULL, 'Thịt ngan', 'Thịt', 300, '100g', 3.20, 5),
(NULL, 'Thịt ba chỉ', 'Thịt', 253, '100g', 4.50, 5),
(NULL, 'Thịt sườn', 'Thịt', 230, '100g', 4.00, 5),
(NULL, 'Thịt dê non', 'Thịt', 130, '100g', 6.50, 7),
(NULL, 'Thịt thỏ', 'Thịt', 173, '100g', 5.00, 5),
(NULL, 'Thịt cá hồi', 'Hải sản', 208, '100g', 8.00, 3),
(NULL, 'Thịt cá basa', 'Hải sản', 91, '100g', 4.50, 3),

(NULL, 'Cá thu', 'Hải sản', 205, '100g', 7.00, 3),
(NULL, 'Cá ngừ', 'Hải sản', 132, '100g', 7.50, 3),
(NULL, 'Tôm sú', 'Hải sản', 99, '100g', 10.00, 3),
(NULL, 'Tôm thẻ', 'Hải sản', 85, '100g', 9.00, 3),
(NULL, 'Mực ống', 'Hải sản', 92, '100g', 8.50, 3),
(NULL, 'Mực ống khô', 'Hải sản', 306, '100g', 12.00, 30),
(NULL, 'Mực khô', 'Hải sản', 350, '100g', 11.00, 30),
(NULL, 'Cua biển', 'Hải sản', 87, '100g', 9.50, 3),
(NULL, 'Hàu', 'Hải sản', 68, '100g', 8.00, 3),
(NULL, 'Sò huyết', 'Hải sản', 74, '100g', 8.20, 3),
(NULL, 'Cá viên', 'Hải sản', 200, '100g', 5.50, 14),
(NULL, 'Chả cá', 'Hải sản', 172, '100g', 6.00, 14),
(NULL, 'Cá lóc', 'Hải sản', 116, '100g', 5.00, 3),
(NULL, 'Cá chép', 'Hải sản', 127, '100g', 4.80, 3),
(NULL, 'Tôm khô', 'Hải sản', 294, '100g', 15.00, 30),
(NULL, 'Cá khô', 'Hải sản', 380, '100g', 13.00, 30),
(NULL, 'Hải sản tổng hợp', 'Hải sản', 120, '100g', 9.00, 3),
(NULL, 'Cá basa', 'Hải sản', 91, '100g', 4.50, 3),
(NULL, 'Cá trích', 'Hải sản', 208, '100g', 7.00, 3),
(NULL, 'Cá thu ngọt', 'Hải sản', 200, '100g', 7.20, 3),

(NULL, 'Sữa tươi', 'Đồ uống', 60, 'lít', 1.20, 7),
(NULL, 'Sữa chua', 'Đồ uống', 59, '100g', 1.50, 10),
(NULL, 'Phô mai', 'Đồ uống', 402, '100g', 3.00, 14),
(NULL, 'Bơ sữa', 'Đồ uống', 717, '100g', 2.50, 14),
(NULL, 'Nước lọc', 'Đồ uống', 0, 'chai', 0.50, 365),
(NULL, 'Nước ngọt', 'Đồ uống', 39, '100ml', 0.40, 180),
(NULL, 'Nước cam ép', 'Đồ uống', 45, '100ml', 1.50, 3),
(NULL, 'Nước dừa', 'Đồ uống', 19, '100ml', 1.20, 3),
(NULL, 'Trà xanh', 'Đồ uống', 2, '100ml', 0.30, 180),
(NULL, 'Cà phê', 'Đồ uống', 1, '100ml', 0.50, 180),
(NULL, 'Sữa đặc', 'Đồ uống', 321, '100g', 1.80, 365),
(NULL, 'Siro trái cây', 'Đồ uống', 280, '100g', 2.00, 365),
(NULL, 'Sữa đậu nành', 'Đồ uống', 54, '100ml', 1.00, 7),
(NULL, 'Nước ép táo', 'Đồ uống', 46, '100ml', 1.80, 5),
(NULL, 'Nước ép lê', 'Đồ uống', 57, '100ml', 1.80, 5),
(NULL, 'Nước ép dứa', 'Đồ uống', 50, '100ml', 1.80, 5),
(NULL, 'Rượu vang', 'Đồ uống', 85, '100ml', 10.00, 365),
(NULL, 'Bia', 'Đồ uống', 43, '100ml', 2.00, 180),
(NULL, 'Nước khoáng', 'Đồ uống', 0, 'chai', 0.40, 365),
(NULL, 'Soda', 'Đồ uống', 34, '100ml', 0.45, 180);


USE foodmanagement;
SELECT * FROM User;