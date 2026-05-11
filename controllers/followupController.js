const Client = require("../models/Client");


// SALES TODAY FOLLOWUPS

exports.getTodayFollowups = async (req,res)=>{

try{

const today = new Date();

today.setHours(0,0,0,0);

const tomorrow = new Date(today);

tomorrow.setDate(today.getDate()+1);

const clients = await Client.find({
assignedTo:req.user.id,
nextCallDate:{
$gte:today,
$lt:tomorrow
}
});

res.json(clients);

}catch(error){

res.status(500).json(error)

}

};



// ADMIN ALL FOLLOWUPS

exports.getAllFollowups = async (req,res)=>{

try{

const today = new Date();

today.setHours(0,0,0,0);

const clients = await Client.find({
nextCallDate:{
$gte:today
}
}).populate("assignedTo","name");

res.json(clients);

}catch(error){

res.status(500).json(error)

}

};