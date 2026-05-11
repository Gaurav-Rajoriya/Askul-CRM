const mongoose = require("mongoose");

const ClientSchema = new mongoose.Schema({

name:{
type:String,
required:true
},

phone:{
type:String,
required:true
},

category:{
type:String
},

assignedTo:{
type:mongoose.Schema.Types.ObjectId,
ref:"User"
},

status:{
type:String,
enum:["new","interested","not interested","followup","closed"],
default:"new"
},

feedback:{
type:String
},

nextCallDate:{
type:Date
}

},{timestamps:true})

module.exports = mongoose.model("Client",ClientSchema)