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
const collect = require('collect.js');

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

router.get('/invited', function (req, res) {
    const user = req.session.userId;
    connection.query(`SELECT e.id AS event_id, e.title, e.location, e.start_time, s.fullname AS sender_fullname, s.username AS sender_username FROM events e LEFT JOIN invitations i ON e.id = i.event_id RIGHT JOIN users u ON i.receiver_id = u.id INNER JOIN users s ON s.id = i.sender_id WHERE u.id = ${user}`)
})

router.get('/going', function (req, res) {
    const user = req.session.userId;
    const query = `SELECT e.id AS event_id, e.title, e.location, e.start_time, i.id AS invitation_id, s.id AS sender_id, s.username AS sender_username, s.fullname AS sender_fullname, fr.friend_id, fr.username AS friend_username, fr.fullname AS friend_fullname FROM events e INNER JOIN invitations i ON e.id = i.event_id INNER JOIN users s ON s.id = i.sender_id INNER JOIN users u ON u.id = i.receiver_id LEFT JOIN (SELECT f.user2_id AS friend_id, fu.username, fu.fullname, r.event_id FROM friends f INNER JOIN responses r ON r.user_id = f.user2_id INNER JOIN users u ON u.id = f.user1_id INNER JOIN users fu ON fu.id = f.user2_id WHERE u.id = ${user}) fr ON fr.event_id = i.event_id WHERE u.id = ${user};`
    connection.query(query, function (error, results) {
        if (!error) {
            const temp = collect(results).groupBy('invitation_id')
            let ret = []
            for (invitation in temp.all()){
                const {event_id, title, location, start_time, invitation_id, sender_id, sender_username, sender_fullname} = temp.all()[invitation].items[0]
                const friends = temp.all()[invitation].items.map(item => ({id: item.friend_id, username: item.friend_username, fullname: item.friend_fullname}))

                ret.push({event_id, title, location, start_time, invitation_id, sender_id, sender_username, sender_fullname, friends: friends[0].id ? friends : []})
            }

            res.status(200).json(ret)
        }
        else {
            console.log(query)
            res.status(500).json({
                success: false, errors: [{
                    "value": "",
                    "msg": "Unknown server error.",
                    "param": "",
                    "location": ""
                }]
            })
        }
    })
})
module.exports = router;
