/**
 * Main configuration.
 */

var app_port = 63334;
var debug = true;

var express = require('express')
    , sio = require('socket.io')
    , util = require('util')
    , i18n = require('i18n')
    , sanitize = require('validator')
    , online = 0
    , total = 0
    , free = 0;

/**
 * Initialize express application.
 */

var app = express();

/**
 * Set application locales.
 */
i18n.configure({
    locales: ['ru', 'en'],
    directory: __dirname + '/locales',
    defaultLocale: 'ru'
});

/**
 * Set application configuration.
 */
app.use(i18n.init);
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname);
app.set('view engine', 'jade');


/**
 * Register helpers for use in templates
 */
app.locals.__i = i18n.__;
app.locals.__n = i18n.__n;

/**
 * Start server
 */
var server = app.listen(process.argv[2] ? process.argv[2] : app_port, function () {

    var address = server.address();

    app.locals.app_host = (address.address == '0.0.0.0') ? '127.0.0.1' : address.address;
    app.locals.app_port = address.port;

    if (debug)
        util.log('App listening on http://' + address.address + ':' + address.port);
});

/**
 * App routes.
 */

app.all('/', function (req, res) {
    res.render('index', { layout: false });
});


/**
 * Socket.IO server (single process only)
 */

var io = sio.listen(server)
    , nicknames = {}
    , users = {}
    , rooms = {};

io.sockets.on('connection', function (socket) {

    var user = {};
    var uid = socket.store.id;
    var room_id = uid + "_room";

    online++;
    total++;

    socket.broadcast.emit('online', total, free);
    socket.emit('online', total, free);

    user.id = socket.store.id;
    users[socket.store.id] = user;

    socket.on('user message', function (msg) {

        msg = sanitize.toString(msg);

        if (debug)
            util.log('Message from ' + socket.user_id + ' to room ' + room_id + ": " + msg);

        socket.broadcast.to(room_id).emit('user message', socket.gender == 1 ? i18n.__("he") : i18n.__("she"), msg);
    });

    socket.on('nickname', function (nick, m_sex, m_age, c_sex, c_age, fn) {

        if (nicknames[socket.user_id]) {
            fn(true);
        } else {
            fn(false);

            nicknames[socket.store.id] = socket.nickname = socket.store.id;

            socket.user_id = socket.store.id;
            socket.gender = m_sex;

            var user = users[socket.store.id];

            user.m_sex = m_sex;
            user.m_age = m_age;
            user.c_sex = c_sex;
            user.c_age = c_age;

            user.active = 0;

            free++;

            // Check existing rooms
            for (var __room in rooms) {

                if (user.active == 0) {

                    _room = rooms[__room];

                    if(debug){
                        util.log(_room.c_sex + " == " + m_sex + " ? " + (_room.c_sex == m_sex));
                        util.log(_room.c_age + " == " + m_age + " ? " + (_room.c_age == m_age));
                        util.log(_room.m_sex + " == " + c_sex + " ? " + (_room.m_sex == c_sex));
                        util.log(_room.m_age + " == " + c_age + " ? " + (_room.m_sex == c_sex));
                        util.log(_room.active + " == " + 0 + " ? " + (_room.active == 0));
                    }

                    if (_room.c_sex == m_sex && _room.c_age == m_age && _room.m_sex == c_sex && _room.m_age == c_age && _room.active == 0) {
                        room_id = _room.id;
                        _room.active = 1;
                        _room.nicknames[socket.user_id] = socket.user_id;
                        user.active = 1
                        free--;
                        if (debug)
                            util.log('Room found! this - ' + room_id);
                    }

                }
            }

            // Create own room
            if (user.active == 0) {
                if (debug)
                    util.log('No room found :( create own - ' + room_id);

                var room = {};

                room.id = room_id;

                room.m_sex = m_sex;
                room.m_age = m_age;
                room.c_sex = c_sex;
                room.c_age = c_age;

                room.active = 0
                room.nicknames = {};
                room.nicknames[socket.user_id] = socket.user_id;

                rooms[room_id] = room;

                socket.emit("user message", "System", i18n.__("waiting"));

            }

            users[socket.store.id] = user;

            socket.join(room_id);

            socket.broadcast.to(room_id).emit('announcement', socket.user_id + ' ' + i18n.__('connected'));
            socket.broadcast.to(room_id).emit('nicknames', rooms[room_id].nicknames);

            socket.emit('nicknames', rooms[room_id].nicknames);
        }
    });

    socket.on('disconnect', function () {

        online--;
        total--;

        socket.broadcast.emit('online', total, free);

        if (!socket.user_id) return;

        if (free > 0) free--;

        socket.broadcast.emit('online', total, free);

        if (debug)
            util.log(socket.user_id);

        socket.leave(room_id);
        socket.broadcast.to(room_id).emit('announcement', socket.user_id + ' ' + i18n.__('disconnected'));

        if (rooms[room_id]) delete rooms[room_id].nicknames[socket.user_id];
        if (rooms[room_id]) socket.broadcast.to(room_id).emit('nicknames', rooms[room_id].nicknames);

        delete users[socket.user_id];
        delete nicknames[socket.user_id];
        delete rooms[room_id];

    });
});
