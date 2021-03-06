var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'event_planner',
    password: 'supersecretpassword',
    database: 'event_planner'
})
var query = require('./mysql-helper');
const { body, validationResult, param } = require('express-validator');
const collect = require('collect.js');

/* GET home page. */
router.get('/', async function (req, res, next) {
    const user = req.session.userId
    try {

        const results = query(`
            SELECT
                e.title,
                e.location,
                e.start_time,
                e.status,
                u.username
            FROM
                events e
                INNER JOIN users u ON
                    e.created_by = u.id
            WHERE
                e.is_private = FALSE
            `);
        res.json(results);
    }
    catch (error) {
        console.log(error)
        res.status(500).json({
            success: false, errors: [{
                "value": "",
                "msg": "Failed retrieving events. The database is probably down.",
                "param": "",
                "location": ""
            }]
        })
    }
});

router.post('/create', [
    body('title').trim()
        .notEmpty()
        .escape(),
    body('start_time').trim()
        .notEmpty()
        .escape(),
    body('end_time').trim()
        .notEmpty()
        .escape()
], async function (req, res) {
    const user = req.session.userId;
    if (user) {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            console.log(errors.array());
            return res.status(422).json({
                success: false, errors: errors.array()

            });
        }
        const { title, location, description, start_time, end_time, is_private } = req.body;
        try {
            await query(`
                INSERT INTO
                    events (
                        title,
                        created_by,
                        start_time,
                        end_time
                        ${location ? ", location" : ""}
                        ${description ? ", description" : ""}
                        ${is_private ? ", is_private" : ""}
                    )
                    VALUES (
                        ?,
                        ?,
                        STR_TO_DATE(?, '%Y-%m-%d %T'),
                        STR_TO_DATE(?, '%Y-%m-%d %T')
                        ${location ? `, ?` : ""}
                        ${description ? `, ?` : ""}
                        ${is_private ? ", TRUE" : ""}
                );`, [title, user, start_time, end_time, location, description, is_private]);
            res.status(201).json({ success: true })
        }
        catch (error) {
            console.log(error);
            res.status(500).json({
                success: false, errors: [{
                    "value": "",
                    "msg": "Unknown server error.",
                    "param": "",
                    "location": ""
                }]
            })
        }
    }
    else {
        res.status(401).json({
            "value": "",
            "msg": "User is not logged in.",
            "param": "",
            "location": ""
        })
    }
});

router.get('/invited', async function (req, res) {
    const user = req.session.userId;
    if (user) {
        try {
            const invites = await query(`
                SELECT
                    e.id event_id,
                    e.title,
                    e.location,
                    e.start_time,
                    i.id invitation_id,
                    s.username sender_username,
                    s.fullname sender_fullname
                FROM
                    events e
                    INNER JOIN invitations i ON
                        e.id = i.event_id
                    INNER JOIN users s ON
                        i.sender_id = s.id
                    INNER JOIN users u ON
                        i.receiver_id = u.id
                WHERE
                    u.id = ${user}
            `);
            const friends_responses = await query(`
                SELECT
                    uf.username,
                    uf.fullname,
                    r.event_id
                FROM
                    friends f
                    INNER JOIN responses r ON
                        r.user_id = f.user2_id
                    INNER JOIN users u ON
                        f.user1_id = u.id
                    INNER JOIN users uf ON
                        f.user2_id = uf.id
                WHERE
                    u.id = ${user} AND
                    r.answer = "going"
            `);
            const ret = invites.map(invite => ({
                ...invite,
                friends: friends_responses.filter(response => response.event_id === invite.event_id).map(friend => ({ username: friend.username, fullname: friend.fullname }))
            }))
            res.status(200).json(ret)
        }
        catch (error) {
            console.log(error)
            res.status(500).json({
                success: false, errors: [{
                    "value": "",
                    "msg": "Unknown server error.",
                    "param": "",
                    "location": ""
                }]
            })
        }
    }
    else {
        res.status(401).json({
            "value": "",
            "msg": "User is not logged in.",
            "param": "",
            "location": ""
        })
    }
})

router.get('/going', async function (req, res) {
    const user = req.session.userId;
    if (user) {
        try {
            const responses = await query(`
                SELECT
                    e.id event_id,
                    e.title,
                    e.location,
                    e.start_time
                FROM
                    events e
                    INNER JOIN responses r ON
                        e.id = r.event_id
                    WHERE
                        r.user_id = ${user} AND
                        r.answer = "going"
            `);
            const friends_responses = await query(`
                SELECT
                    uf.username,
                    uf.fullname,
                    r.event_id
                FROM
                    friends f
                    INNER JOIN responses r ON
                        r.user_id = f.user2_id
                    INNER JOIN users u ON
                        f.user1_id = u.id
                    INNER JOIN users uf ON
                        f.user2_id = uf.id
                WHERE
                    u.id = ${user} AND
                    r.answer = "going"`)
            const ret = responses.map(response => ({
                ...response,
                friends: friends_responses.filter(res => res.event_id === response.event_id).map(friend => ({ username: friend.username, fullname: friend.fullname }))
            }))
            res.status(200).json(ret)
        }
        catch (error) {
            console.log(error)
            res.status(500).json({
                success: false, errors: [{
                    "value": "",
                    "msg": "Unknown server error.",
                    "param": "",
                    "location": ""
                }]
            })
        }
    }
    else {
        res.status(401).json({
            "value": "",
            "msg": "User is not logged in.",
            "param": "",
            "location": ""
        })
    }
})

router.get('/event/:event_id', [
    param('event_id').trim()
        .notEmpty().withMessage("You must provide an event ID.")
        .isInt().withMessage("Event ID must be an integer.")
        .escape()
], async function (req, res) {
    const event_id = req.params.event_id;
    const user = req.session.userId;
    if (user) {
        try {
            const queryStr = `
                SELECT
                    e.title,
                    e.location,
                    e.description,
                    c.username created_by,
                    e.start_time,
                    e.end_time,
                    e.status,
                    i.id invitation,
                    r.id response,
                    g.count people_going
                FROM
                    events e
                    INNER JOIN (
                        SELECT
                            COUNT(r.id) count,
                            r.event_id
                        FROM
                            responses r
                        WHERE
                            r.answer = 'going'
                        GROUP BY
                            r.event_id
                    ) g ON e.id = g.event_id
                INNER JOIN users c ON
                    e.created_by = c.id
                LEFT JOIN responses r ON
                    e.id = r.event_id
                LEFT JOIN invitations i ON
                    e.id = i.event_id
            WHERE
                e.id = ${event_id} AND (
                    e.is_private = FALSE OR
                    i.receiver_id = ${user} OR
                    e.created_by = ${user} OR
                    r.answer = 'going' AND
                    r.user_id = ${user}
                )
            `;
            const eventInfo = await query(queryStr)
            const friendsInfo = await query(`
                SELECT
                    u.username,
                    u.fullname
                FROM
                    users u
                    INNER JOIN friends f ON
                        u.id = f.user2_id
                    INNER JOIN responses r ON
                        r.user_id = u.id
                WHERE
                    r.event_id = ${event_id} AND
                    r.answer = "going" AND
                    f.user1_id = ${user}
            `)
            if (eventInfo.length > 0) {
                const { title, location, description, created_by, start_time, end_time, status, people_going } = eventInfo[0];
                res.status(200).json({ title, location, description, created_by, start_time, end_time, status, people_going, friends_going: friendsInfo.map(friend => ({ username: friend.username, fullname: friend.fullname })) })
            }
            else {
                res.status(404).json({
                    success: false, errors: [
                        {
                            "value": event_id,
                            "msg": "Event not found.",
                            "param": "event_id",
                            "location": "params"
                        }
                    ]
                })
            }
        }
        catch (error) {
            console.log(error);
            res.status(500).json({
                success: false, errors: [{
                    "value": "",
                    "msg": "Unknown server error.",
                    "param": "",
                    "location": ""
                }]
            })
        }
    }
    else {
        res.status(401).json({
            "value": "",
            "msg": "User is not logged in.",
            "param": "",
            "location": ""
        })
    }
})
module.exports = router;
