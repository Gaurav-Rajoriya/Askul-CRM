const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
{
  name:{
    type:String,
    required:true
  },

  phone:{
    type:String
  },

  username:{
    type:String,
    required:true,
    unique:true
  },

  password:{
    type:String,
    required:true
  },

  role:{
    type:String,
    enum:["admin","sales"],
    default:"sales"
  }

},
{timestamps:true}
);

module.exports = mongoose.model("User",UserSchema);