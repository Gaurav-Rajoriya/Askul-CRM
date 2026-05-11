const User = require("../models/User");
const bcrypt = require("bcryptjs");


// CREATE SALES EXECUTIVE
exports.createSales = async (req,res)=>{

try{

const {name,phone,username,password,role} = req.body;

const userExists = await User.findOne({username});

if(userExists){
return res.status(400).json({message:"Username already exists"});
}

const salt = await bcrypt.genSalt(10);

const hashedPassword = await bcrypt.hash(password,salt);

const user = await User.create({
name,
phone,
username,
password:hashedPassword,
role: role || "sales"
});

res.json({
message:"Sales executive created",
user
})

}catch(error){

res.status(500).json(error)

}

}



// GET ALL USERS
exports.getUsers = async(req,res)=>{

try{

const users = await User.find().select("-password");

res.json(users);

}catch(error){

res.status(500).json(error)

}

}



// UPDATE USER
exports.updateUser = async(req,res)=>{

try{

const {name,phone,username,password,role} = req.body;

let updateData = {
name,
phone,
username,
role
}

if(password){

const salt = await bcrypt.genSalt(10);

updateData.password = await bcrypt.hash(password,salt);

}

const user = await User.findByIdAndUpdate(
req.params.id,
updateData,
{new:true}
).select("-password");

res.json(user);

}catch(error){

res.status(500).json(error)

}

}



// DELETE USER
exports.deleteUser = async(req,res)=>{

try{

await User.findByIdAndDelete(req.params.id);

res.json({message:"User deleted"});

}catch(error){

res.status(500).json(error)

}

}