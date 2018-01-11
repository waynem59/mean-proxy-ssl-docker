const mongoose = require('mongoose');
const mongooseUniqueValidator = require('mongoose-unique-validator');
const Schema = mongoose.Schema;


// create mongoose schema
const userSchema = new Schema({
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    name: String,
    age: Number
});

module.exports = mongoose.model('User', userSchema);
