var socket = io.connect("http://" + app_host + ":" + app_port);

socket.on('connect', function () {

    $('#chat').addClass('connected');

    if ($.cookie("m_sex")) {
        $("#m_sex_" + $.cookie("m_sex")).addClass("selected");
        $("#m_sex").val($.cookie("m_sex"));
    }

    if ($.cookie("m_age")) {
        $("#m_age_" + $.cookie("m_age")).addClass("selected");
        $("#m_age").val($.cookie("m_age"));
    }

    if ($.cookie("c_sex")) {
        $("#c_sex_" + $.cookie("c_sex")).addClass("selected");
        $("#c_sex").val($.cookie("c_sex"));
    }

    if ($.cookie("c_age")) {
        $("#c_age_" + $.cookie("c_age")).addClass("selected");
        $("#c_age").val($.cookie("c_age"));
    }

});


socket.on('announcement', function (msg) {
    $('#lines').append($('<p>').append($('<em>').text(msg)));
});

socket.on('nicknames', function (nicknames) {

    $('#nicknames').empty().append($('<span>В сети: </span>'));
    var count = 0;
    for (var i in nicknames) {
        $('#nicknames').append($('<b>').text(nicknames[i]));
        count++;
    }
    if (count > 1) {
        message('System', 'Собеседник найден. Приятного общения!');
        $('#send').removeAttr('disabled');
        $('#message').removeAttr('disabled').focus();
    } else {
        $('#send').attr('disabled', 'disabled');
        $('#message').attr('disabled', 'disabled');
    }
});

socket.on('online', function (total, free) {
    $('span.online').empty().html('Всего ' + total + ' (ожидают - ' + free + ')');
});

socket.on('user message', message);
socket.on('reconnect', function () {
    $('#lines').remove();
    message('System', 'Пересоединение с сервером');
});

socket.on('reconnecting', function () {
    message('System', 'Попытка переподключения...');
});

socket.on('error', function (e) {
    message('System', e ? e : 'Возникла необъяснимая ошибка');
});

function message(from, msg) {
    $('#lines').append($('<p>').append($('<b>').text(from), msg));
    $('#lines').get(0).scrollTop = 10000000;
}

// Set sex before connecting
// who - 0 companion, 1 - me
// sex - 1 male, 2 - female
function setSex(who, sex, wtf) {

    if (who == 0) {
        $("td.c_sex span").removeClass("selected");
        $('#c_sex').val(sex);
    } else {
        $("td.m_sex span").removeClass("selected");
        $('#m_sex').val(sex);
    }

    $(wtf).addClass("selected");

}

// Set sex before connecting
// who - 0 companion, 1 - me
// age - text
function setAge(who, age, wtf) {

    if (who == 0) {
        $("td.c_age span").removeClass("selected");
        $('#c_age').val(age);
    } else {
        $("td.m_age span").removeClass("selected");
        $('#m_age').val(age);
    }

    $("td.age span").removeClass("selected");
    $(wtf).addClass("selected");
}

// dom manipulation
$(function () {
    $('#set-nickname').submit(function (ev) {
        socket.emit(
            'nickname',
            $('#nick').val(),
            $('#m_sex').val(),
            $('#m_age').val(),
            $('#c_sex').val(),
            $('#c_age').val(),
            function (set) {
                if (!set) {
                    clear();
                    //$.cookie("nick", $('#nick').val());
                    $.cookie("m_sex", $('#m_sex').val());
                    $.cookie("m_age", $('#m_age').val());
                    $.cookie("c_sex", $('#c_sex').val());
                    $.cookie("c_age", $('#c_age').val());

                    $('#reconnect').show();

                    return $('#chat').addClass('nickname-set');
                }
                $('#nickname-err').css('visibility', 'visible');

            });
        return false;
    });


    $('#send-message').submit(function () {
        message('Я', $('#message').val());
        socket.emit('user message', $('#message').val());
        clear();
        $('#lines').get(0).scrollTop = 10000000;
        return false;
    });

    function clear() {
        $('#message').val('').focus();
    };
});