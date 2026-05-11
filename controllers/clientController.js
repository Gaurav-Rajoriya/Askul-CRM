const Client = require("../models/Client");


// ADD CLIENT (ADMIN)
exports.addClient = async (req,res)=>{

try{

const {name,phone,category,assignedTo} = req.body;

const client = await Client.create({
name,
phone,
category,
assignedTo
});

res.json({
message:"Client added successfully",
client
})

}catch(error){

res.status(500).json(error)

}

}



 // GET ALL CLIENTS (ADMIN)

exports.getClients = async(req,res)=>{

try{

const clients = await Client.find()
.populate("assignedTo","name username");

res.json(clients)

}catch(error){

res.status(500).json(error)

}

}



 // GET MY CLIENTS (SALES)

exports.getMyClients = async(req,res)=>{

try{

const clients = await Client.find({
assignedTo:req.user.id
});

res.json(clients)

}catch(error){

res.status(500).json(error)

}

}



 // UPDATE CLIENT STATUS

exports.updateStatus = async(req,res)=>{

try{

const {status,feedback,nextCallDate} = req.body;

const client = await Client.findByIdAndUpdate(
req.params.id,
{
status,
feedback,
nextCallDate
},
{new:true}
)

res.json(client)

}catch(error){

res.status(500).json(error)

}

}

// GET CLIENT BY ID
exports.getClientById = async (req, res) => {

try {

const client = await Client.findById(req.params.id).populate(
"assignedTo",
"name"
);

if (!client) {
return res.status(404).json({ message: "Client not found" });
}

res.json(client);

} catch (error) {

res.status(500).json(error);

}

};

// UPDATE CLIENT

exports.updateClient = async (req, res) => {

try {

const { name, phone, category, assignedTo } = req.body;

const client = await Client.findByIdAndUpdate(
req.params.id,
{
name,
phone,
category,
assignedTo
},
{ new: true }
);

res.json(client);

} catch (error) {

res.status(500).json(error);

}

};

// DELETE CLIENT

exports.deleteClient = async (req,res)=>{

try{

const client = await Client.findById(req.params.id);

if(!client){
return res.status(404).json({
message:"Client not found"
})
}

await Client.findByIdAndDelete(req.params.id);

res.json({
message:"Client deleted successfully"
})

}catch(error){

res.status(500).json(error)

}

}