var rates  = ['b/s', 'KiB/s', 'MiB/s', 'GiB/s', 'TiB/s', 'PiB/s'];
var shortrates  = ['b', 'K', 'M', 'G', 'T', 'P'];

function elapsedstr(elapsed) {
    if(elapsed < 60)
        return elapsed + ' seconds ago';

    elapsed /= 60
    if(elapsed < 60)
        return elapsed.toFixed(0) + ' minutes ago';

    return (elapsed / 60).toFixed(0) + ' hours ago';
}

function elapsedvisibiliy(elapsed) {
    if(elapsed < 3600)
        return 'visibility-recent';

    if(elapsed < (3600 * 3))
        return 'visibility-middle';

    return 'visibility-old';
}

function autosize(value) {
	var temp = value / 1024;
	var unitidx = 2;

	if(temp > 4096) {
		temp /= 1024;
		unitidx = 3;
	}

	return temp.toFixed(2) + ' ' + units[unitidx];
}

//
// return a value prefixed by zero if < 10
//
function zerolead(value) {
	return (value < 10) ? '0' + value : value;
}

//
// convert a unix timestamp to readable european date/hours
//
function unixtime(timestamp) {
	var date = new Date(timestamp * 1000);

	var hours = zerolead(date.getHours()) + ':' +
	            zerolead(date.getMinutes()) + ':' +
	            zerolead(date.getSeconds());

	return hours;
}

//
// compute a scaled size with adapted prefix
//
function rate(value) {
	value = value / 1024;
	uindex = 1;

	for(; value > 1024; value /= 1024)
		uindex++;

	return value.toFixed(2) + ' ' + rates[uindex];
}

function shortrate(value) {
	value = value / 1024;
	uindex = 1;

	for(; value > 1024; value /= 1024)
		uindex++;

	return value.toFixed(2) + ' ' + shortrates[uindex];
}

//
// return formated percent format with different colors
// scaled with value. optional output text can be used
//
function percent(value, extra) {
	return value + ' %' + ((extra) ? ' (' + extra + ')' : '');
}

function connect() {
    socket = new WebSocket("ws://" + window.location.host + "/ws");

    socket.onopen = function() {
        console.log("websocket open");
        $('#disconnected').hide();
    }

    socket.onmessage = function(msg) {
        json = JSON.parse(msg.data);
        update_clients(json);
    }

    socket.onclose = function() {
        $('#disconnected').show();
        setTimeout(connect, 2000);
    }
}


function rxtxclass(value) {
    if(value < 8 * 1024)
        return 'text-muted';

    if(value < 112 * 1024)
        return 'text-default';

    if(value < 1112 * 1024)
        return 'badge-warning';

    return 'badge-danger';
}

function rxtxactive(value) {
    if(value < 8 * 1024)
        return 'inactive';

    return 'active';
}

function clientscmp(a, b) {
    a = a['addr'].split('.');
    b = b['addr'].split('.');

    for(var i = 0; i < a.length; i++) {
        if((a[i] = parseInt(a[i])) < (b[i] = parseInt(b[i])))
            return -1;

        else if(a[i] > b[i])
            return 1;
    }

    return 0;
}

var cachetable = {};

function update_clients(clients) {
    $('.devices').empty();

    var downarrow = '<span class="glyphicon glyphicon-small glyphicon-arrow-down"></span> ';
    var uparrow = '<span class="glyphicon glyphicon-small glyphicon-arrow-up"></span> ';

    for(var index in clients) {
        var client = clients[index];

        if(cachetable[client['addr']] == undefined) {
            cachetable[client['addr']] = 0;
        }

        // var elapsed = (now.getTime() / 1000) - client['timestamp'];
        var rx = (client['rx'] != undefined) ? client['rx'] : null;
        var tx = (client['tx'] != undefined) ? client['tx'] : null;

        if(client['rx'] == 0 && client['tx'] == 0) {
            if(cachetable[client['addr']] < Math.round((new Date()).getTime() / 1000) - 180)
                continue;
        }

        var tr = $('<tr>');
        tr.append($('<td>').html(client['host']));
        tr.append($('<td>').html(client['addr']));

        tr.append($('<td>', {'class': rxtxactive(rx)})
            .append($('<span>', {'class': rxtxclass(rx) + ' badge'}).html(downarrow + shortrate(rx)))
        );
        tr.append($('<td>', {'class': rxtxactive(tx)})
            .append($('<span>', {'class': rxtxclass(tx) + ' badge'}).html(uparrow + shortrate(tx)))
        );

        cachetable[client['addr']] = Math.round((new Date()).getTime() / 1000);

        var badgeclass = 'badge pull-right';
        var badgehtml = "---";

        var badge = $('<span>', {'class': badgeclass}).html(badgehtml);
        tr.append($('<td>').append(badge));

        $('.devices').append(tr);
    }
}

$(document).ready(function() {
    connect();
});
