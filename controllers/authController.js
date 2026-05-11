const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


// REGISTER USER
exports.register = async (req, res) => {

try {

const {name, phone, username, password, role} = req.body;

const userExists = await User.findOne({username});

if(userExists){
 return res.status(400).json({message:"User already exists"});
}

const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);

const user = await User.create({
 name,
 phone,
 username,
 password: hashedPassword,
 role
});

const token = jwt.sign(
 {id:user._id, role:user.role},
 process.env.JWT_SECRET,
 {expiresIn:"7d"}
);

res.json({
 message:"User created successfully",
 token,
 user
});

} catch (error) {

res.status(500).json(error);

}

};



// LOGIN USER
exports.login = async (req,res)=>{

const {username,password} = req.body;

try{

const user = await User.findOne({username});

if(!user){
 return res.status(400).json({message:"User not found"});
}

const isMatch = await bcrypt.compare(password,user.password);

if(!isMatch){
 return res.status(400).json({message:"Invalid credentials"});
}

const token = jwt.sign(
 {id:user._id, role:user.role},
 process.env.JWT_SECRET,
 {expiresIn:"7d"}
);

res.json({
 token,
 user
});

}catch(err){

res.status(500).json(err)

}

}