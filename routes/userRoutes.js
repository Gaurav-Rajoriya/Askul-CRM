const express = require("express");
const router = express.Router();

const {
createSales,
getUsers,
updateUser,
deleteUser
} = require("../controllers/userController");

const protect = require("../middleware/authMiddleware");


// CREATE SALES
router.post("/add", protect, createSales);


// GET USERS
router.get("/", protect, getUsers);


// UPDATE USER
router.put("/:id", protect, updateUser);


// DELETE USER
router.delete("/:id", protect, deleteUser);


module.exports = router;