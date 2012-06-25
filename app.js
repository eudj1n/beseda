/**
 * Module dependencies.
 */

var app_port = 63334;
  
var express = require('express')
  , stylus = require('stylus')
  , nib = require('nib')
  , sio = require('socket.io')
  , util = require('util')
  , i18n = require('i18n')
  , sanitize = require('validator').sanitize
  , online = 0
  , total = 0
  , free = 0;

var globals = {};

/**
 * App.
 */

var app = express.createServer();

/**
 * App configuration.
 */
i18n.configure({
    // setup some locales - other locales default to en silently
    locales:['ru', 'en']
});

app.configure(function () {
  app.use(i18n.init);
  app.use(app.router);
  app.use(stylus.middleware({ src: __dirname + '/public', compile: compile }));
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname);
  app.set('view engine', 'jade');

  function compile (str, path) {
    return stylus(str)
      .set('filename', path)
      .use(nib());
  };
});

// register helpers for use in templates
app.helpers({
  __i: i18n.__,
  __n: i18n.__n
});

/**
 * App listen.
 */

app.listen(process.argv[2] ? process.argv[2] : app_port, function () {
  
  var addr = app.address();
  
  globals.app_host = addr.address;
  globals.app_port = addr.port;
  
  console.log('   app listening on http://' + addr.address + ':' + addr.port);
});

/**
 * App routes.
 */

app.all('/', function (req, res) {
    //console.log(globals);
  res.render('index', { layout: false, locals:globals });
});


/**
 * Socket.IO server (single process only)
 */

var io = sio.listen(app)
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
        
        msg = sanitize(msg).entityEncode();
        
        console.log('           message from ' + socket.user_id + ' to room ' + room_id + ": " + msg);
        // Write He and She unstead usernames
        socket.broadcast.to(room_id).emit('user message', socket.gender == 1 ? i18n.__("he") : i18n.__("she") , msg);
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
      for(var __room in rooms){
          
          if(user.active == 0){
          
              _room = rooms[__room];

              console.log(_room.c_sex + " == " + m_sex + " ? " + (_room.c_sex == m_sex));
              console.log(_room.c_age + " == " + m_age + " ? " + (_room.c_age == m_age));
              console.log(_room.m_sex + " == " + c_sex + " ? " + (_room.m_sex == c_sex));
              console.log(_room.m_age + " == " + c_age + " ? " + (_room.m_sex == c_sex));
              console.log(_room.active + " == " + 0 + " ? " + (_room.active == 0));

              if(_room.c_sex == m_sex && _room.c_age == m_age && _room.m_sex == c_sex && _room.m_age == c_age && _room.active == 0){
                  room_id = _room.id;
                  _room.active = 1;
                  _room.nicknames[socket.user_id] = socket.user_id;
                  user.active = 1
                  free--;
                  console.log('         room finded! this - ' + room_id);
              }
          
          }
      }
      
      // Create own room
      if(user.active == 0){
          
          console.log('         no room finded :( create own - ' + room_id);
          
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
    
    if(free > 0) free--;
    
    socket.broadcast.emit('online', total, free);
    
    console.log(socket.user_id);
    
    socket.leave(room_id);
    socket.broadcast.to(room_id).emit('announcement', socket.user_id + ' ' +  i18n.__('disconnected'));
    
    if(rooms[room_id]) delete rooms[room_id].nicknames[socket.user_id];
    if(rooms[room_id]) socket.broadcast.to(room_id).emit('nicknames', rooms[room_id].nicknames);
    
    delete users[socket.user_id];
    delete nicknames[socket.user_id];
    delete rooms[room_id];
    
  });
});
