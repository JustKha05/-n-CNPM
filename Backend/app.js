const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');
const cors = require('cors');
const session = require('express-session');

const app = express();
const port = 3001;

app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
    },
  })
);

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ userId: req.session.userId });
  } else {
    res.status(401).send('Unauthorized');
  }
});

app.get('/user-info', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Chưa đăng nhập' });
  res.json({ userId: req.session.userId });
});

// Đăng ký user mới
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ email và mật khẩu' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query('INSERT INTO User (Email, Password) VALUES (?, ?)', [email, hashedPassword], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ success: false, message: '❌ Email đã tồn tại!' });
        }
        return res.status(500).json({ success: false, message: '❌ Lỗi đăng ký: ' + err.message });
      }

      const newUserId = result.insertId;

      // Copy toàn bộ thực phẩm mẫu (UserID = NULL), giữ ShelfLife
      const copyFoodsSql = `
        INSERT INTO Food (UserID, Name, Category, Calories, Unit, Price, ShelfLife)
        SELECT ?, Name, Category, Calories, Unit, Price, ShelfLife FROM Food WHERE UserID IS NULL
      `;
      db.query(copyFoodsSql, [newUserId], (copyErr) => {
        if (copyErr) {
          console.error('❌ Lỗi sao chép thực phẩm mẫu:', copyErr);
          return res.status(500).json({ success: false, message: '❌ Lỗi sao chép dữ liệu mẫu' });
        }
        return res.status(201).json({ success: true, message: 'Đăng ký thành công!' });
      });
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: '❌ Lỗi hệ thống' });
  }
});

// Đăng nhập user
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập email' });
  }
  if (!password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu' });
  }

  db.query('SELECT * FROM User WHERE Email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: '❌ Lỗi truy vấn' });
    if (results.length === 0) return res.status(400).json({ success: false, message: '❌ Email không tồn tại' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.Password);

    if (!match) return res.status(400).json({ success: false, message: '❌ Sai mật khẩu!' });

    // Đặt session
    req.session.userId = user.UserID;

    // Trả JSON để React điều hướng
    return res.json({ success: true, redirectUrl: '/home' });
  });
});

// Kiểm tra session
function authMiddleware(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).send('Unauthorized: Vui lòng đăng nhập');
  }
}

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Lỗi khi đăng xuất');
    }
    res.redirect('/login.html');
  });
});

// =========================
// QUẢN LÝ THỰC PHẨM CHUNG
// =========================

// Lấy tất cả thực phẩm của chính họ
app.get('/foods', authMiddleware, (req, res) => {
  const userId = req.session.userId;

  db.query('SELECT * FROM Food WHERE UserID = ?', [userId], (err, results) => {
    if (err) {
      console.error('❌ Lỗi lấy danh sách thực phẩm:', err);
      return res.status(500).send('Lỗi máy chủ');
    }
    res.json(results);
  });
});

// Thêm thực phẩm mới vào bảng Food (dùng ShelfLife thay vì ExpiryDate)
app.post('/add-new-food', authMiddleware, (req, res) => {
  const userId = req.session.userId;
  const { name, category, calories, unit, price, shelfLife } = req.body;

  if (!userId || !name || !unit || isNaN(calories) || calories <= 0) {
    return res.status(400).json({ success: false, message: 'Tên, Calories, và Đơn vị là bắt buộc' });
  }

  // BƯỚC KIỂM TRA TRÙNG LẶP
  const checkSql = 'SELECT FoodID FROM Food WHERE UserID = ? AND Name = ?';
  db.query(checkSql, [userId, name.trim()], (checkErr, checkResults) => {
    if (checkErr) {
      return res.status(500).json({ success: false, message: 'Lỗi server khi kiểm tra' });
    }
    if (checkResults.length > 0) {
      return res.status(409).json({ success: false, message: `Thực phẩm "${name.trim()}" đã tồn tại trong danh mục của bạn.` }); // 409 Conflict
    }

    const insertSql = `INSERT INTO Food (UserID, Name, Category, Calories, Unit, Price, ShelfLife) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(
      insertSql,
      [userId, name.trim(), category || null, calories, unit, price || null, shelfLife || 0],
      (err) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Lỗi thêm thực phẩm: ' + err.message });
        }
        res.status(201).json({ success: true, message: 'Thêm thực phẩm thành công' });
      }
    );
  });
});

// API để cập nhật một thực phẩm đã có
app.put('/update-food/:foodId', authMiddleware, (req, res) => {
  const userId = req.session.userId;
  const { foodId } = req.params;
  const { name, category, calories, unit, price, shelfLife } = req.body;

  if (!name || !unit || isNaN(calories) || calories <= 0) {
    return res.status(400).json({ success: false, message: 'Tên, Calories, và Đơn vị là bắt buộc' });
  }

  // 1. Kiểm tra xem người dùng có quyền sửa thực phẩm này không
  const ownerCheckSql = 'SELECT * FROM Food WHERE FoodID = ? AND UserID = ?';
  db.query(ownerCheckSql, [foodId, userId], (ownerErr, ownerResults) => {
    if (ownerErr) return res.status(500).json({ success: false, message: 'Lỗi server' });
    if (ownerResults.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa thực phẩm này.' });
    }

    // 2. Kiểm tra xem tên mới có bị trùng với một thực phẩm khác không (ngoại trừ chính nó)
    const duplicateCheckSql = 'SELECT FoodID FROM Food WHERE UserID = ? AND Name = ? AND FoodID != ?';
    db.query(duplicateCheckSql, [userId, name.trim(), foodId], (dupErr, dupResults) => {
      if (dupErr) return res.status(500).json({ success: false, message: 'Lỗi server' });
      if (dupResults.length > 0) {
        return res.status(409).json({ success: false, message: `Tên thực phẩm "${name.trim()}" đã được sử dụng.` });
      }

      // 3. Nếu mọi thứ ổn, tiến hành cập nhật
      const updateSql = `
        UPDATE Food 
        SET Name = ?, Category = ?, Calories = ?, Unit = ?, Price = ?, ShelfLife = ?
        WHERE FoodID = ?`;
      
      db.query(
        updateSql,
        [name.trim(), category || null, calories, unit, price || null, shelfLife || 0, foodId],
        (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ success: false, message: 'Lỗi cập nhật thực phẩm: ' + updateErr.message });
          }
          res.json({ success: true, message: 'Cập nhật thành công' });
        }
      );
    });
  });
});

// Kiểm tra xem một thực phẩm có đang được sử dụng ở đâu không
app.get('/check-food-usage/:foodId', authMiddleware, (req, res) => {
    const userId = req.session.userId;
    const { foodId } = req.params;

    if (!foodId) {
        return res.status(400).json({ error: 'Thiếu Food ID' });
    }

    const checkRecipeSql = `
        SELECT DISTINCT d.Name 
        FROM Recipe r 
        JOIN Dish d ON r.DishID = d.DishID
        WHERE r.FoodID = ? AND d.UserID = ?`;
    
    const checkMealPlanSql = `
        SELECT DISTINCT DayOfWeek 
        FROM MealPlan 
        WHERE FoodID = ? AND UserID = ? AND Eaten = 0`;

    Promise.all([
        new Promise((resolve, reject) => {
            db.query(checkRecipeSql, [foodId, userId], (err, results) => {
                if (err) return reject(err);
                resolve(results.map(r => r.Name)); // Trả về mảng tên các món ăn
            });
        }),
        new Promise((resolve, reject) => {
            db.query(checkMealPlanSql, [foodId, userId], (err, results) => {
                if (err) return reject(err);
                resolve(results.map(r => r.DayOfWeek)); // Trả về mảng các ngày trong tuần
            });
        })
    ])
    .then(([dishes, mealPlanDays]) => {
        res.json({
            isInRecipe: dishes.length > 0,
            dishes: dishes,
            isInMealPlan: mealPlanDays.length > 0,
            mealPlanDays: [...new Set(mealPlanDays)] // Đảm bảo các ngày là duy nhất
        });
    })
    .catch(err => {
        console.error("Lỗi khi kiểm tra sử dụng thực phẩm:", err);
        res.status(500).json({ error: "Lỗi máy chủ khi kiểm tra dữ liệu." });
    });
});

// Xóa thực phẩm khỏi bảng Food
app.post('/delete-shared-food', authMiddleware, (req, res) => {
  const userId = req.session.userId;
  const { foodId } = req.body;

  if (!foodId || !userId) return res.status(400).send('Thiếu foodId hoặc userId');

  db.query('SELECT * FROM Food WHERE FoodID = ? AND UserID = ?', [foodId, userId], (err, results) => {
    if (err) {
      console.error('❌ Lỗi truy vấn:', err);
      return res.status(500).send('❌ Lỗi máy chủ');
    }

    if (results.length === 0) {
      return res.status(403).send('❌ Bạn không có quyền xóa thực phẩm này');
    }

    db.query('DELETE FROM Food WHERE FoodID = ?', [foodId], (err2) => {
      if (err2) {
        console.error('❌ Lỗi khi xoá:', err2);
        return res.status(500).send('❌ Không thể xoá thực phẩm');
      }
      res.send('✅ Đã xoá thực phẩm thành công');
    });
  });
});

// =========================
// QUẢN LÝ THỰC PHẨM NGƯỜI DÙNG
// =========================

// Thêm thực phẩm vào userfood
app.post('/add-to-userfood', authMiddleware, (req, res) => {
    const userId = req.session.userId;
    const { foodId, quantity, date } = req.body;
    if (!foodId || !quantity || quantity <= 0 || !date) {
        return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
    }

    db.query('SELECT Name, Calories FROM Food WHERE FoodID = ?', [foodId], (errF, foods) => {
        if (errF || foods.length === 0) return res.status(500).json({ error: 'Lỗi lấy thông tin Food' });
        const { Name, Calories } = foods[0];

        const selSql = `SELECT ID, Quantity FROM userfood WHERE UserID = ? AND FoodID = ? AND DateAdded = ?`;
        db.query(selSql, [userId, foodId, date], (errS, rows) => {
            if (errS) return res.status(500).json({ error: 'Lỗi kiểm tra kho' });

            if (rows.length > 0) {
                const newQty = rows[0].Quantity + quantity;
                db.query('UPDATE userfood SET Quantity = ? WHERE ID = ?', [newQty, rows[0].ID], (errU) => {
                    if (errU) return res.status(500).json({ error: 'Lỗi cập nhật kho' });
                    res.json({ message: 'Đã cộng dồn vào kho' });
                });
            } else {
                const insSql = `INSERT INTO userfood (UserID, FoodID, Name, Calories, Quantity, DateAdded) VALUES (?, ?, ?, ?, ?, ?)`;
                db.query(insSql, [userId, foodId, Name, Calories, quantity, date], (errI) => {
                    if (errI) return res.status(500).json({ error: 'Lỗi thêm vào kho' });
                    res.json({ message: 'Đã thêm mới vào kho' });
                });
            }
        });
    });
});


// Lấy danh sách thực phẩm của user, kèm ShelfLife và ExpirationDate = DateAdded + ShelfLife ngày
app.get('/user-foods', authMiddleware, (req, res) => {
    const userId = req.session.userId;
    const sql = `
      SELECT 
        uf.ID as id, uf.FoodID, f.Name, f.Calories, f.Unit, uf.Quantity, uf.DateAdded,
        f.ShelfLife, DATE_ADD(uf.DateAdded, INTERVAL f.ShelfLife DAY) AS ExpirationDate
      FROM userfood uf
      JOIN Food f ON uf.FoodID = f.FoodID
      WHERE uf.UserID = ? AND uf.Quantity > 0
      ORDER BY uf.DateAdded DESC, uf.ID DESC`;
    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Lỗi database' });
        res.json(results);
    });
});

// Xóa 1 thực phẩm khỏi userfood
app.post('/delete-user-food', authMiddleware, (req, res) => {
    const userId = req.session.userId;
    const { id } = req.body;
    if (!id) return res.status(400).send('Thiếu ID');
    db.query('DELETE FROM userfood WHERE id = ? AND UserID = ?', [id, userId], (err, result) => {
        if (err) return res.status(500).send('Lỗi DB');
        if (result.affectedRows === 0) return res.status(403).send('Không có quyền xóa');
        res.send('Xóa lô hàng thành công');
    });
});

// =========================
// QUẢN LÝ THỰC ĐƠN CÁ NHÂN
// =========================

// Lấy danh sách thực đơn cá nhân theo UserID trong session + gợi ý món ăn người dùng có thể thêm
app.get('/get-meals', authMiddleware, (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized: Vui lòng đăng nhập' });

  const mealsSql = `
    SELECT 
      MealPlan.ID,
      MealPlan.FoodID,
      MealPlan.DayOfWeek,
      MealPlan.Quantity,
      MealPlan.Eaten,
      Food.Name AS FoodName,
      Food.Calories,
      Food.Unit
    FROM MealPlan
    JOIN Food ON MealPlan.FoodID = Food.FoodID
    WHERE MealPlan.UserID = ?
    ORDER BY 
      FIELD(MealPlan.DayOfWeek, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'), 
      MealPlan.ID
  `;

  // Lấy danh sách món ăn (dishes) gợi ý dựa trên nguyên liệu Food user có (hoặc tất cả món ăn user tạo)
  const suggestDishesSql = `
    SELECT d.DishID, d.Name, d.Description
    FROM Dish d
    WHERE d.UserID = ?
  `;

  db.query(mealsSql, [userId], (err, meals) => {
    if (err) {
      console.error('Error loading meals:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    db.query(suggestDishesSql, [userId], (err2, dishes) => {
      if (err2) {
        console.error('Error loading suggested dishes:', err2);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        meals,
        suggestedDishes: dishes
      });
    });
  });
});

// Thêm món ăn hoặc thực phẩm riêng vào MealPlan
app.post('/add-meal', authMiddleware, (req, res) => {
  const userId = req.session.userId;
  const { dishId, foodId, quantity, dayOfWeek } = req.body;

  if (!userId || !dayOfWeek) {
    return res.status(400).json({ error: 'Thiếu dữ liệu người dùng hoặc ngày' });
  }

  // === Trường hợp 1: Thêm theo món ăn (DishID) ===
  if (dishId) {
    const checkDishSql = `SELECT DishID FROM Dish WHERE DishID = ? AND UserID = ?`;
    db.query(checkDishSql, [dishId, userId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Lỗi hệ thống' });
      if (results.length === 0) return res.status(403).json({ error: 'Món ăn không tồn tại hoặc không có quyền' });

      const getIngredientsSql = `SELECT r.FoodID, r.Quantity FROM Recipe r WHERE r.DishID = ?`;
      db.query(getIngredientsSql, [dishId], (err2, ingredients) => {
        if (err2) return res.status(500).json({ error: 'Lỗi hệ thống' });
        if (ingredients.length === 0) return res.status(400).json({ error: 'Món ăn không có nguyên liệu' });

        const values = ingredients.map(i => [userId, i.FoodID, i.Quantity, dayOfWeek, 0]);
        const insertMealSql = `INSERT INTO MealPlan (UserID, FoodID, Quantity, DayOfWeek, Eaten) VALUES ?`;
        db.query(insertMealSql, [values], (err3) => {
          if (err3) return res.status(500).json({ error: 'Lỗi thêm thực đơn' });
          res.json({ message: '✅ Đã thêm món ăn vào thực đơn' });
        });
      });
    });

  // === Trường hợp 2: Thêm thực phẩm riêng (FoodID + Quantity) ===
  } else if (foodId && quantity && quantity > 0) {
    const checkFoodSql = `SELECT FoodID FROM Food WHERE FoodID = ?`;
    db.query(checkFoodSql, [foodId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Lỗi kiểm tra thực phẩm' });
      if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy thực phẩm' });

      const insertSql = `
        INSERT INTO MealPlan (UserID, FoodID, Quantity, DayOfWeek, Eaten)
        VALUES (?, ?, ?, ?, 0)
      `;
      db.query(insertSql, [userId, foodId, quantity, dayOfWeek], (err2, result) => {
        if (err2) return res.status(500).json({ error: 'Lỗi thêm thực phẩm vào thực đơn' });
        res.json({ message: '✅ Đã thêm thực phẩm vào thực đơn', id: result.insertId });
      });
    });

  } else {
    return res.status(400).json({ error: 'Thiếu dishId hoặc foodId/quantity hợp lệ' });
  }
});



// Xóa món trong thực đơn cá nhân
app.post('/delete-meal', authMiddleware, (req, res) => {
  const UserID = req.session.userId;
  const { mealId } = req.body;
  if (!UserID || !mealId) {
    return res.status(400).json({ error: 'Thiếu dữ liệu cần thiết' });
  }

  const sql = `DELETE FROM MealPlan WHERE ID = ? AND UserID = ?`;
  db.query(sql, [mealId, UserID], (err, result) => {
    if (err) {
      console.error("Lỗi khi xóa mục MealPlan:", err);
      return res.status(500).json({ error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy mục kế hoạch để xóa hoặc không có quyền.' });
    }
    res.json({ message: 'Đã xóa món khỏi kế hoạch thành công' });
  });
});

// Tìm đến endpoint app.post('/update-eaten', ...) và thay thế TOÀN BỘ bằng phiên bản này.

app.post('/update-eaten', authMiddleware, (req, res) => {
  const userId = req.session.userId;
  const { mealId, eaten, date } = req.body;

  if (mealId === undefined || eaten === undefined || !date) {
    return res.status(400).json({ error: 'Thiếu dữ liệu' });
  }

  db.beginTransaction(err => {
    if (err) {
      console.error("Lỗi bắt đầu transaction:", err);
      return res.status(500).json({ error: 'Lỗi server' });
    }

    // 1. Cập nhật cờ Eaten trên MealPlan
    db.query('UPDATE MealPlan SET Eaten = ? WHERE ID = ? AND UserID = ?', [eaten ? 1 : 0, mealId, userId], (errUpdate, result) => {
      if (errUpdate) {
        return db.rollback(() => {
          console.error("Lỗi bước 1 - UPDATE MealPlan:", errUpdate);
          res.status(500).json({ error: 'Lỗi cập nhật MealPlan' });
        });
      }

      if (result.affectedRows === 0) {
        return db.rollback(() => {
          res.status(404).json({ message: 'Không tìm thấy món ăn trong kế hoạch hoặc không có quyền' });
        });
      }
      
      if (!eaten) {
        return db.commit(errCommit => {
            if(errCommit) return db.rollback(() => res.status(500).json({ error: 'Lỗi commit' }));
            res.json({ message: 'Đã bỏ đánh dấu ăn.' });
        });
      }

      // 2. Lấy thông tin món ăn từ MealPlan
      const getMealInfoSql = `
        SELECT 
          mp.FoodID, 
          mp.Quantity, 
          f.Name, 
          f.Calories 
        FROM MealPlan AS mp 
        JOIN Food AS f ON mp.FoodID = f.FoodID 
        WHERE mp.ID = ?`;

      db.query(getMealInfoSql, [mealId], (errInfo, mealRows) => {
        if (errInfo) {
          return db.rollback(() => {
            console.error("Lỗi bước 2 - SELECT meal info:", errInfo);
            res.status(500).json({ message: 'Lỗi truy vấn thông tin món ăn' });
          });
        }

        if (mealRows.length === 0) {
            return db.rollback(() => {
              console.error(`Lỗi logic: Không tìm thấy MealPlan.ID = ${mealId} sau khi đã update.`);
              res.status(404).json({ message: 'Không tìm thấy thông tin món ăn đã lên kế hoạch' });
            });
        }
        
        const { FoodID, Quantity, Name, Calories } = mealRows[0];

        // 3. Ghi vào ConsumptionLog
        const logSql = 'INSERT INTO ConsumptionLog (UserID, FoodID, Name, Calories, Quantity, ConsumedAt) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(logSql, [userId, FoodID, Name, Calories, Quantity, date], (errLog) => {
          if (errLog) {
            return db.rollback(() => {
              console.error("Lỗi bước 3 - INSERT ConsumptionLog:", errLog);
              res.status(500).json({ error: 'Lỗi ghi nhật ký tiêu thụ' });
            });
          }

          // 4. Bắt đầu logic trừ kho tuần tự (FIFO)
          let remainingToConsume = Quantity;

          function consumeNextBatch() {
            if (remainingToConsume <= 0) {
              return db.commit(errCommit => {
                  if(errCommit) return db.rollback(() => res.status(500).json({ error: 'Lỗi commit' }));
                  res.json({ message: 'Đã ghi nhận tiêu thụ và cập nhật kho' });
              });
            }

            const getBatchSql = "SELECT ID, Quantity FROM userfood WHERE UserID = ? AND FoodID = ? AND Quantity > 0 ORDER BY DateAdded ASC, ID ASC LIMIT 1";
            db.query(getBatchSql, [userId, FoodID], (errBatch, batches) => {
              if (errBatch) {
                return db.rollback(() => {
                  console.error("Lỗi bước 4a - SELECT userfood batch:", errBatch);
                  res.status(500).json({ error: 'Lỗi xử lý kho' });
                });
              }

              if (batches.length === 0) {
                console.warn(`Kho đã hết FoodID ${FoodID} cho UserID ${userId}.`);
                return db.commit(errCommit => {
                    if(errCommit) return db.rollback(() => res.status(500).json({ error: 'Lỗi commit' }));
                    res.json({ message: 'Đã ghi nhận tiêu thụ (cảnh báo: kho không đủ)' });
                });
              }

              const batch = batches[0];
              const quantityToTake = Math.min(batch.Quantity, remainingToConsume);

              const updateBatchSql = "UPDATE userfood SET Quantity = Quantity - ? WHERE ID = ?";
              db.query(updateBatchSql, [quantityToTake, batch.ID], (errUpdateBatch) => {
                if (errUpdateBatch) {
                  return db.rollback(() => {
                    console.error("Lỗi bước 4b - UPDATE userfood batch:", errUpdateBatch);
                    res.status(500).json({ error: 'Lỗi cập nhật kho' });
                  });
                }
                remainingToConsume -= quantityToTake;
                consumeNextBatch();
              });
            });
          }
          
          consumeNextBatch();
        });
      });
    });
  });
});


// =========================
// QUẢN LÝ MUA SẮM
// =========================
// Lấy danh sách ShoppingList của người dùng hiện tại
app.get('/shopping-list', (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Bạn chưa đăng nhập" });

  const sql = `
    SELECT ID, FoodID, Name, Quantity, UnitPrice, TotalPrice
    FROM ShoppingList
    WHERE UserID = ?
      AND Purchased = 0
    ORDER BY CreatedAt DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "Lỗi database khi lấy danh sách" });
    res.json(results);
  });
});



// Lấy danh sách shopping list theo UserID
app.post("/add-shopping", (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Bạn chưa đăng nhập" });

  const { foodId, quantity, unitPrice } = req.body;
  if (!foodId || !quantity || !unitPrice || quantity <= 0 || unitPrice < 0) {
    return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  }

  db.query("SELECT Name FROM Food WHERE FoodID = ?", [foodId], (err, foodResults) => {
    if (err) return res.status(500).json({ error: "Lỗi truy vấn món ăn" });
    if (foodResults.length === 0) return res.status(404).json({ error: "Không tìm thấy món ăn" });

    const foodName = foodResults[0].Name;
    const totalPrice = quantity * unitPrice;

    // Cập nhật giá mới vào bảng Food
    db.query("UPDATE Food SET Price = ? WHERE FoodID = ?", [unitPrice, foodId], (errUpdate) => {
      if (errUpdate) return res.status(500).json({ error: "Lỗi cập nhật giá trong bảng Food" });

      // Chèn vào shopping list
      db.query(
        "INSERT INTO ShoppingList (UserID, FoodID, Name, Quantity, UnitPrice, TotalPrice) VALUES (?, ?, ?, ?, ?, ?)",
        [userId, foodId, foodName, quantity, unitPrice, totalPrice],
        (errInsert, result) => {
          if (errInsert) {
            console.error("❌ Lỗi khi chèn vào shopping list:", errInsert);
            return res.status(500).json({ error: "Lỗi khi thêm vào shopping list" });
          }

          res.json({ id: result.insertId });
        }
      );
    });
  });
});

// Đánh dấu một mục trong shopping list là đã mua
app.post("/mark-purchased", authMiddleware, (req, res) => {
    const userId = req.session.userId;
    const { id, date } = req.body;
    if (!id || !date) {
      return res.status(400).json({ error: "Thiếu id hoặc date" });
    }
  
    db.query('SELECT FoodID, Quantity FROM ShoppingList WHERE ID = ? AND UserID = ?', [id, userId], (err, shoppingRows) => {
      if (err || shoppingRows.length === 0) return res.status(404).json({ error: "Không tìm thấy mục mua" });
      
      const { FoodID, Quantity } = shoppingRows[0];
  
      db.query('UPDATE ShoppingList SET Purchased = 1, CreatedAt = ? WHERE ID = ?', [date, id], (errMark) => {
        if (errMark) return res.status(500).json({ error: "Lỗi đánh dấu đã mua" });
  
        // Gọi logic thêm vào kho
        db.query('SELECT Name, Calories FROM Food WHERE FoodID = ?', [FoodID], (errF, foods) => {
          if (errF || foods.length === 0) return res.status(500).json({ error: 'Lỗi lấy thông tin Food' });
          const { Name, Calories } = foods[0];
  
          const selSql = `SELECT ID, Quantity FROM userfood WHERE UserID = ? AND FoodID = ? AND DateAdded = ?`;
          db.query(selSql, [userId, FoodID, date], (errS, rows) => {
            if (errS) return res.status(500).json({ error: 'Lỗi kiểm tra kho' });
  
            if (rows.length > 0) {
              const newQty = rows[0].Quantity + Quantity;
              db.query('UPDATE userfood SET Quantity = ? WHERE ID = ?', [newQty, rows[0].ID], (errU) => {
                if (errU) return res.status(500).json({ error: 'Lỗi cập nhật kho' });
                res.json({ message: 'Đã thêm vào kho' });
              });
            } else {
              const insSql = `INSERT INTO userfood (UserID, FoodID, Name, Calories, Quantity, DateAdded) VALUES (?, ?, ?, ?, ?, ?)`;
              db.query(insSql, [userId, FoodID, Name, Calories, Quantity, date], (errI) => {
                if (errI) return res.status(500).json({ error: 'Lỗi thêm vào kho' });
                res.json({ message: 'Đã thêm vào kho' });
              });
            }
          });
        });
      });
    });
});



// Gợi ý mua sắm: món cần mua thêm dựa trên kế hoạch ăn và kho thực phẩm hiện có
app.get("/suggest-shopping-quantity", authMiddleware, (req, res) => {
    const userId = req.session.userId;
  
    // 1. Lấy tổng số lượng cần cho kế hoạch ăn (chưa ăn)
    const sqlMealPlan = `
      SELECT f.Name, SUM(mp.Quantity) as totalPlanQty, f.Price, f.FoodID
      FROM MealPlan mp
      JOIN Food f ON mp.FoodID = f.FoodID
      WHERE mp.UserID = ? AND mp.Eaten = 0
      GROUP BY f.Name, f.Price, f.FoodID
    `;
  
    // 2. Lấy số lượng TỒN KHO THỰC TẾ từ bảng userfood
    const sqlInventory = `
      SELECT Name, SUM(Quantity) as totalHaveQty
      FROM userfood
      WHERE UserID = ?
      GROUP BY Name
      HAVING totalHaveQty > 0
    `;

    // 3. Lấy số lượng ĐANG CHỜ MUA TRONG GIỎ HÀNG
    const sqlShoppingList = `
      SELECT Name, SUM(Quantity) as totalInCartQty
      FROM ShoppingList
      WHERE UserID = ? AND Purchased = 0
      GROUP BY Name
    `;
  
    // Chạy cả 3 câu truy vấn song song
    Promise.all([
        new Promise((resolve, reject) => db.query(sqlMealPlan, [userId], (e,r) => e ? reject(e) : resolve(r))),
        new Promise((resolve, reject) => db.query(sqlInventory, [userId], (e,r) => e ? reject(e) : resolve(r))),
        new Promise((resolve, reject) => db.query(sqlShoppingList, [userId], (e,r) => e ? reject(e) : resolve(r)))
    ])
    .then(([mealPlanResults, inventoryResults, shoppingListResults]) => {
        
        // Map số lượng tồn kho
        const haveMap = new Map();
        inventoryResults.forEach(item => {
          haveMap.set(item.Name, item.totalHaveQty);
        });

        // Map số lượng trong giỏ hàng
        const inCartMap = new Map();
        shoppingListResults.forEach(item => {
          inCartMap.set(item.Name, item.totalInCartQty);
        });
  
        const suggestions = [];
  
        mealPlanResults.forEach(mpItem => {
          const haveQty = haveMap.get(mpItem.Name) || 0;
          const inCartQty = inCartMap.get(mpItem.Name) || 0;

          // Logic tính toán mới và chính xác
          const needQty = mpItem.totalPlanQty - haveQty - inCartQty;
  
          if (needQty > 0) {
            suggestions.push({
              FoodID: mpItem.FoodID,
              Name: mpItem.Name,
              NeedQuantity: needQty,
              Price: mpItem.Price || 0
            });
          }
        });
  
        res.json(suggestions);
    })
    .catch(err => {
        console.error("Lỗi khi gợi ý mua sắm:", err);
        return res.status(500).json({ error: "Lỗi máy chủ khi xử lý gợi ý" });
    });
  });



// Cập nhật một mục trong ShoppingList
app.put('/update-shopping-item/:id', authMiddleware, (req, res) => {
    const userId = req.session.userId;
    const { id } = req.params;
    const { quantity, unitPrice } = req.body;

    if (!quantity || !unitPrice || quantity <= 0 || unitPrice < 0) {
        return res.status(400).json({ error: "Số lượng và giá không hợp lệ." });
    }

    const totalPrice = quantity * unitPrice;

    const sql = `
        UPDATE ShoppingList 
        SET Quantity = ?, UnitPrice = ?, TotalPrice = ?
        WHERE ID = ? AND UserID = ?`;

    db.query(sql, [quantity, unitPrice, totalPrice, id, userId], (err, result) => {
        if (err) {
            console.error("Lỗi cập nhật ShoppingList:", err);
            return res.status(500).json({ error: "Lỗi database" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Không tìm thấy mục cần cập nhật hoặc không có quyền." });
        }
        res.json({ message: "Cập nhật giỏ hàng thành công" });
    });
});

// Xoá một mục trong shopping list
app.post('/delete-shopping', (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: 'Bạn chưa đăng nhập' });

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Thiếu ID' });

  db.query('DELETE FROM ShoppingList WHERE ID = ? AND UserID = ?', [id, userId], (err, result) => {
    if (err) {
      console.error('❌ Lỗi khi xoá mục mua sắm:', err);
      return res.status(500).json({ error: 'Lỗi khi xoá mục mua sắm' });
    }
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy mục mua sắm' });
    }
    res.json({ message: 'Đã xoá mục mua sắm thành công' });
  });
});



















// =========================
// QUẢN LÝ MÓN ĂN
//=========================
// API lấy danh sách dishes với nguyên liệu
app.get('/api/dishes', authMiddleware, (req, res) => {
  const userId = req.session.userId;

  db.query(
    'SELECT DishID, Name, Description FROM Dish WHERE UserID = ? OR UserID IS NULL',
    [userId],
    (err, dishes) => {
      if (err) return res.status(500).json({ error: 'Lỗi máy chủ' });
      const results = [];

      if (dishes.length === 0) return res.json([]);

      let done = 0;
      dishes.forEach(dish => {
        db.query(
          `SELECT f.Name AS FoodName, r.Quantity
           FROM Recipe r
           JOIN Food f ON r.FoodID = f.FoodID
           WHERE r.DishID = ?`,
          [dish.DishID],
          (err2, ingredients) => {
            results.push({
              DishID: dish.DishID,
              Name: dish.Name,
              Description: dish.Description,
              Ingredients: ingredients
            });
            if (++done === dishes.length) {
              res.json(results);
            }
          }
        );
      });
    }
  );
});

// API lấy danh sách món ăn của người dùng
app.get('/api/dishes/:id', authMiddleware, (req, res) => {
  const userId = req.session.userId;
  const dishId = req.params.id;

  db.query(
    'SELECT * FROM Dish WHERE DishID = ? AND (UserID = ? OR UserID IS NULL)',
    [dishId, userId],
    (err, result) => {
      if (err || result.length === 0) return res.status(404).json({ error: 'Không tìm thấy món' });

      const dish = result[0];
      db.query(
        `SELECT f.Name AS FoodName, r.FoodID, r.Quantity
         FROM Recipe r
         JOIN Food f ON r.FoodID = f.FoodID
         WHERE r.DishID = ?`,
        [dishId],
        (err2, ingredients) => {
          if (err2) return res.status(500).json({ error: 'Lỗi lấy nguyên liệu' });

          res.json({
            DishID: dish.DishID,
            Name: dish.Name,
            Description: dish.Description,
            Ingredients: ingredients
          });
        }
      );
    }
  );
});

// API cập nhật món ăn (và nguyên liệu liên quan)
app.put('/api/dishes/:id', authMiddleware, (req, res) => {
  const userId = req.session.userId;
  const dishId = req.params.id;
  const { name, description, ingredients } = req.body;

  if (!name || !Array.isArray(ingredients) || ingredients.length === 0)
    return res.status(400).json({ error: 'Thiếu thông tin' });

  db.query(
    'SELECT * FROM Dish WHERE DishID = ? AND UserID = ?',
    [dishId, userId],
    (err, result) => {
      if (err || result.length === 0)
        return res.status(403).json({ error: 'Bạn không có quyền sửa món này' });

      // Cập nhật món
      db.query(
        'UPDATE Dish SET Name = ?, Description = ? WHERE DishID = ?',
        [name, description || null, dishId],
        err2 => {
          if (err2) return res.status(500).json({ error: 'Lỗi cập nhật món' });

          // Xoá nguyên liệu cũ
          db.query('DELETE FROM Recipe WHERE DishID = ?', [dishId], err3 => {
            if (err3) return res.status(500).json({ error: 'Lỗi xoá nguyên liệu cũ' });

            const values = ingredients.map(i => [dishId, i.FoodID, i.Quantity]);
            db.query('INSERT INTO Recipe (DishID, FoodID, Quantity) VALUES ?', [values], err4 => {
              if (err4) return res.status(500).json({ error: 'Lỗi thêm nguyên liệu mới' });
              res.json({ message: 'Cập nhật món thành công' });
            });
          });
        }
      );
    }
  );
});



// API thêm món ăn
app.post('/api/dishes', authMiddleware, (req, res) => {
  const UserID = req.session.userId;
  const { name, description, ingredients } = req.body;

  if (!name || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: 'Thiếu tên món hoặc nguyên liệu' });
  }

  const insertDishSql = 'INSERT INTO Dish (UserID, Name, Description) VALUES (?, ?, ?)';
  db.query(insertDishSql, [UserID, name, description || null], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    const dishId = result.insertId;
    const values = ingredients.map(i => [dishId, i.FoodID, i.Quantity]);
    const insertIngredientsSql = 'INSERT INTO Recipe (DishID, FoodID, Quantity) VALUES ?';

    db.query(insertIngredientsSql, [values], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Thêm món thành công' });
    });
  });
});



// API xoá món ăn (và nguyên liệu liên quan)
app.delete('/api/dishes/:id', authMiddleware, (req, res) => {
  const userId = req.session.userId;
  const dishId = req.params.id;

  const checkDishSql = 'SELECT * FROM Dish WHERE DishID = ? AND UserID = ?';
  db.query(checkDishSql, [dishId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Lỗi kiểm tra quyền: ' + err.message });
    if (results.length === 0) return res.status(403).json({ error: 'Bạn không có quyền xoá món này' });

    db.query('DELETE FROM Recipe WHERE DishID = ?', [dishId], (err1) => {
      if (err1) return res.status(500).json({ error: 'Lỗi khi xoá nguyên liệu: ' + err1.message });

      db.query('DELETE FROM Dish WHERE DishID = ?', [dishId], (err2) => {
        if (err2) return res.status(500).json({ error: 'Lỗi khi xoá món ăn: ' + err2.message });

        res.json({ message: 'Xoá món thành công' });
      });
    });
  });
});


// API cập nhật món ăn
app.get('/suggest-dishes', authMiddleware, (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const sql = `
        SELECT 
            d.DishID,
            d.Name,
            d.Description,
            -- Tính toán tỉ lệ khớp: (số nguyên liệu có / tổng số nguyên liệu cần)
            (COUNT(uf.FoodID) / total_ingredients.count) AS match_ratio
        FROM Dish d
        -- 1. JOIN để lấy tất cả nguyên liệu cần thiết cho mỗi món ăn
        JOIN Recipe r ON d.DishID = r.DishID
        -- 2. JOIN để đếm tổng số nguyên liệu của mỗi món ăn
        JOIN (
            SELECT DishID, COUNT(*) as count 
            FROM Recipe 
            GROUP BY DishID
        ) AS total_ingredients ON d.DishID = total_ingredients.DishID
        -- 3. INNER JOIN để CHỈ lấy những món ăn mà người dùng có ÍT NHẤT MỘT nguyên liệu trong kho
        INNER JOIN userfood uf ON r.FoodID = uf.FoodID AND uf.UserID = ? AND uf.Quantity > 0
        -- 4. Chỉ lấy các món ăn của người dùng hoặc món ăn mẫu
        WHERE d.UserID = ? OR d.UserID IS NULL
        GROUP BY d.DishID, d.Name, d.Description, total_ingredients.count
        -- 5. Sắp xếp theo tỉ lệ khớp giảm dần
        ORDER BY match_ratio DESC
    `;

    db.query(sql, [userId, userId], (err, results) => {
        if (err) {
            console.error('❌ Lỗi gợi ý món ăn:', err);
            return res.status(500).json({ error: 'Lỗi máy chủ' });
        }
        res.json(results);
    });
});


// =========================
//Thông kê
// =========================

// API thống kê chi tiêu và số lượng thực phẩm theo ngày
app.get("/api/stats/daily", authMiddleware, (req, res) => {
    const userId = req.session.userId;
    const days = Math.max(1, parseInt(req.query.days, 10) || 7);
  
    const spendingSql = `SELECT DATE_FORMAT(CreatedAt, '%Y-%m-%d') AS date, IFNULL(SUM(TotalPrice), 0) AS totalSpending FROM ShoppingList WHERE UserID = ? AND Purchased = 1 AND CreatedAt >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY date ORDER BY date`;
    
    // Lấy dữ liệu từ bảng ConsumptionLog
    const consumptionSql = `SELECT DATE_FORMAT(ConsumedAt, '%Y-%m-%d') AS date, IFNULL(SUM(Quantity), 0) AS totalQuantity, IFNULL(SUM(Calories * Quantity), 0) AS totalCalories FROM ConsumptionLog WHERE UserID = ? AND ConsumedAt >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY date ORDER BY date`;
  
    Promise.all([
      new Promise((resolve, reject) => db.query(spendingSql, [userId, days], (e, r) => e ? reject(e) : resolve(r))),
      new Promise((resolve, reject) => db.query(consumptionSql, [userId, days], (e, r) => e ? reject(e) : resolve(r))),
    ]).then(([spendingRows, consumptionRows]) => {
      const dataMap = new Map();
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1) + i);
        const key = d.toISOString().slice(0, 10);
        dataMap.set(key, { date: key, totalSpending: 0, totalQuantity: 0, totalCalories: 0 });
      }
      spendingRows.forEach(r => { if(dataMap.has(r.date)) dataMap.get(r.date).totalSpending = r.totalSpending; });
      consumptionRows.forEach(r => {
        if(dataMap.has(r.date)) {
            dataMap.get(r.date).totalQuantity = r.totalQuantity;
            dataMap.get(r.date).totalCalories = r.totalCalories;
        }
      });
      res.json(Array.from(dataMap.values()));
    }).catch(err => res.status(500).json({ error: "Lỗi máy chủ" }));
});
  
app.get("/api/stats/by-food", authMiddleware, (req, res) => {
    const userId = req.session.userId;
    const days = Math.max(1, parseInt(req.query.days, 10) || 30);
  
    const spendingSql = `SELECT Name, SUM(TotalPrice) AS totalSpending FROM ShoppingList WHERE UserID = ? AND Purchased = 1 AND CreatedAt >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY Name`;

    // Lấy dữ liệu từ bảng ConsumptionLog
    const consumptionSql = `SELECT Name, SUM(Quantity) AS totalQuantity, SUM(Calories * Quantity) AS totalCalories FROM ConsumptionLog WHERE UserID = ? AND ConsumedAt >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY Name`;
  
    Promise.all([
      new Promise((resolve, reject) => db.query(spendingSql, [userId, days], (e, r) => e ? reject(e) : resolve(r))),
      new Promise((resolve, reject) => db.query(consumptionSql, [userId, days], (e, r) => e ? reject(e) : resolve(r))),
    ]).then(([spendingRows, consumptionRows]) => {
      const summaryMap = new Map();
      consumptionRows.forEach(row => {
        summaryMap.set(row.Name, { name: row.Name, totalQuantity: row.totalQuantity || 0, totalCalories: row.totalCalories || 0, totalSpending: 0 });
      });
      spendingRows.forEach(row => {
        if (summaryMap.has(row.Name)) {
          summaryMap.get(row.Name).totalSpending = row.totalSpending || 0;
        }
      });
      res.json(Array.from(summaryMap.values()));
    }).catch(err => res.status(500).json({ error: "Lỗi máy chủ" }));
});


// Khởi động server
app.listen(port, () => {
  console.log(`Server đang chạy trên http://localhost:${port}`);
});