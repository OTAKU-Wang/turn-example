// 产生随机数
if (!location.hash) {
    location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
let clientId;
if (!localStorage.getItem("clientId")) {
    clientId = Math.floor(Math.random() * 0xFFFFFF).toString(16);
    localStorage.setItem("clientId", clientId);
} else {
    clientId = localStorage.getItem("clientId");
}
// 获取房间号
const roomHash = location.hash.substring(1);


// 房间名必须以 'observable-'开头
const roomName = 'observable-' + roomHash;
const configuration = {
    iceServers: [{
        urls: ['turn:10.180.151.105:3478?transport=tcp'],
        username: 'inspur1',
        credential: '123456',
    }]
};
var pc;

let socket = new WebSocket("ws://10.180.151.105:3479/ws");

class Message {
    static  CMD = {
        register: 'register',
        send: 'send',
    }

    constructor(cmd, roomid, clientid, msg) {
        this.cmd = cmd;
        this.roomid = roomid;
        this.clientid = clientid
        this.msg = msg
    }
}

fetch('http://10.180.151.105:3479/' + roomName + '/' + clientId, {method: "DELETE"}).catch(e => console.error(e));
pc = new RTCPeerConnection(configuration);
socket.onopen = function (e) {
    console.log("[open] Connection established");
    let message = new Message(Message.CMD.register, roomName, clientId, "");
    console.log("Sending to server", message);
    socket.send(JSON.stringify(message));
    message.cmd = Message.CMD.send
    message.msg = JSON.stringify({'clientId': clientId})
    socket.send(JSON.stringify(message))
    fetch("http://10.180.151.105:3479/getRoomCnt?roomId=" + roomName, {method: "GET"}).then(res => res.json()).then((j) => {
        pc.onicecandidate = function (event) {
            if (event.candidate) {
                sendMessage({'candidate': event.candidate, 'clientId': clientId});
            }
        };
        if (j.clientCount === 2 && pc.onnegotiationneeded === null) {
            pc.onnegotiationneeded = function () {
                // 创建本地sdp描述 SDP (Session Description Protocol) session描述协议
                pc.createOffer().then(localDescCreated).catch(e => console.error(e));
            };
        }
        pc.ontrack = function (event) {
            const [remoteStream] = event.streams;
            remoteVideo.srcObject = remoteStream;
        };
        // 获取本地媒体流
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        }).then(function (stream) {
            // 将本地捕获的视频流装载到本地video中
            localVideo.srcObject = stream;

            // 将本地流加入RTCPeerConnection 实例中 发送到其他端
            pc.addStream(stream);
        }).catch(e => console.error(e));
    })
};

socket.onmessage = function (e) {
    let res = JSON.parse(JSON.parse(e.data).msg.replace('/\\/g', ''));
    if (res.clientId === clientId) {
        return
    }
    if (res.sdp) {
        // 设置远程sdp, 在offer 或者 answer后
        pc.setRemoteDescription(new RTCSessionDescription(res.sdp)).then(() => {
            if (pc.remoteDescription.type === 'offer') {
                pc.createAnswer().then(localDescCreated).catch(e => console.error(e));
            }
        }).catch(e => console.error(e));
    } else if (res.candidate) {
        // 增加新的 ICE canidatet 到本地的链接中
        pc.addIceCandidate(res.candidate).then(() => {
        }).catch((e) => console.error(e));
    }
}
socket.onclose = function (e) {
    fetch('http://10.180.151.105:3479/' + roomName + '/' + clientId, {method: "DELETE"}).then(res => res.json()).then(s => console.log(s))
}

function sendMessage(message) {
    let mes = new Message(Message.CMD.send, roomName, clientId, JSON.stringify(message));
    socket.send(JSON.stringify(mes));
}

function localDescCreated(desc) {
    pc.setLocalDescription(desc).then(() => {
        sendMessage({'sdp': pc.localDescription, 'clientId': clientId});
    }).catch(e => console.error(e));
}
