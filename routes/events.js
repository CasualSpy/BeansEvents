var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'event_planner',
    password: 'supersecretpassword',
    database: 'event_planner'
})
const {body, validationResult} = require('express-validator');

/* GET home page. */
router.get('/', function(req, res, next) {
    const user = req.session.userId
    connection.query('SELECT e.title, e.location, e.start_time, e.status, u.username FROM events e INNER JOIN users u ON e.created_by = u.id LEFT JOIN invitations i ON i.event_id = e.id WHERE i.receiver_id = "${user}" OR e.is_private = FALSE', function (error, results, fields) {
        if (!error){
            res.json(results);
        }
        else {
            console.log(error)
            res.status(500).json({success:false, errors: [{
                "value": "",
                "msg": "Failed retrieving events. The database is probably down.",
                "param": "",
                "location": ""
            }]})
        }
    });
});

router.post('/create', [
    body('title').trim()
      .notEmpty(),
    body('created_by').trim()
      .notEmpty(),
    body('start_time').trim()
      .notEmpty(),
    body('end_time').trim()
      .notEmpty()
], function(req, res) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false, errors: errors.array()

        });
    }
    const {title, location, created_by, description, start_time, end_time, is_private} = req.body;
    connection.query(`INSERT INTO events (title, created_by, start_time, end_time${location ? ", location" : ""}${description ? ", description" : ""}${is_private ? ", is_private" : ""}) VALUES ("${title}", ${created_by}, "${start_time}", "${end_time}"${location ? `, "${location}"` : ""}${description ? `, "${description}"` : ""}${is_private ? ", TRUE" : ""})`, function(error, results, fields) {
        if (!error) {
            console.log(results);
            res.status().json({success: true})
        } else {
            console.log(error);
            res.status(500).json({success: false, errors: [{
                "value": "",
                "msg":  "Unknown server error.",
                "param": "",
                "location": ""
            }]})
        }
    });
});

module.exports = router;
