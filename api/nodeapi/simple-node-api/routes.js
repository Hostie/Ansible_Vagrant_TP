const express = require('express');
const todos = require("./todos");

const router = express.Router();

router.get("/api", function(req, res) {
  res.json(todos);
});

module.exports = router;
