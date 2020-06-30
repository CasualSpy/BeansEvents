var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'event_planner',
    password: 'supersecretpassword',
    database: 'event_planner'
})

/* GET home page. */
router.get('/', function(req, res, next) {
    connection.query('SELECT * FROM events INNER JOIN users on events.created_by = users.id', function (error, results, fields) {
        res.json(results);
    });
});

router.post('/create', function(req, res) {
    const {title, location, description, created_by, start_time, end_time} = req.body;
    if (title && created_by && start_time && end_time) {
        connection.query(`INSERT INTO events (title, created_by, start_time, end_time${location ? ", location" : ""}${description ? ", description" : ""}) VALUES ("${title}", ${created_by}, "${start_time}", "${end_time}"${location ? `, "${location}"` : ""}${description ? `, "${description}"` : ""})`, function(error, results, fields) {
            if (!error) {
                console.log(results);
                res.json({success: true})
            } else {
                console.log(error);
               res.json({error: error.sqlMessage})
            }
        });
    }
})

module.exports = router;
