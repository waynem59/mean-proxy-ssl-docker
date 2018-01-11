const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');


/* GET api listing. */
router.get('/', (req, res) => {
    res.send('Hello world!');
});

module.exports = router;