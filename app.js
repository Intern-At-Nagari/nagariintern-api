const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/config/config.js')[env];
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");
const publicRoutes = require("./routes/public");
const superAdminRoutes = require("./routes/superAdmin");


// Use CORS middleware
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());


app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public/template'));
// Basic route
app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

// API routes
app.use("/", publicRoutes); // Route yang bisa diakses semua orang
app.use("/auth", authRoutes); // Route untuk autentikasi
app.use("/admin", adminRoutes); // Hanya untuk admin
app.use("/superadmin", superAdminRoutes); // Hanya untuk super admin
app.use("/", userRoutes);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});