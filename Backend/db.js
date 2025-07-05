const mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'Database',
  password: 'Trungkien@8',
  database: 'foodmanagement',
});

connection.connect((err) => {
  if (err) throw err;
  console.log('✅ Connected to MySQL');
});

module.exports = connection;
