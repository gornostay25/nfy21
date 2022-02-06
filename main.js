import {Worker} from "worker_threads"
import { randomUUID } from "crypto"
import server from "./server.js"
import fs from "fs/promises"

server.api = function (query) {
    switch (query.type) {
        case "get":
            return {
                worker:downlcount,
                memory,
                duration,
                queue
            }
        case "change_workers":
            downlcount = query.data
            return "ok"

        case "add":
            if (qlock) {
                console.error("Whait concat finishing")
                return "Whait concat finishing"
            }
            
            let tempnew = query.data

            if (tempnew.format == "3") {
                tempnew.id = tempnew.url
                tempnew.progress = "saved"
                tempnew.status = "fd"
            }else{
                tempnew.id = randomUUID()
                tempnew.progress = "downloading"
            }

            commands.push({type:"add_queue",data:tempnew})
        return "ok";

        case "concat":
            if (downloaders.length>0) {
                return "Please whait to all finished"
            }
            qlock = true
            commands.push({type:'concat'})
        return "ok"

    }
}

let downlcount = 5,
memory = "--",
bytes = 0,
duration = "--",
seconds = 0,
queue = [],
commands = [],
port = 8080,
interval = 5 * 1000,

downloaders = [],

getbdate = ()=>new Date().toISOString().replace(/\D/g,"."),

backup_n = getbdate(),

qlock=false

const startbpath = './src/start.json'

fs.readFile(startbpath).then(d=>d.toString()).then(d=>JSON.parse(d)).then(d=>{
    qlock = true
    queue = d.queue
    downlcount = d.downlcount
    bytes = (bytes>0)?bytes:0
    memory = formatBytes(bytes)
    seconds = (seconds>0)?seconds:0
    duration = msToTime(seconds)
    qlock = false
}).catch(e=>null)

//queue
setInterval(() => {
    if (qlock) return
    for (const q of queue) {
        if(!q.status){
            if (downloaders.length<downlcount){
                q.status="d"
                const w = new Worker("./downloader.js",{
                    workerData:q
                })
                register(w)
            }
        }
    }

}, interval);

//commands
setInterval(async () => {
    if (commands.length){
        let cmnd = commands.shift()
        switch (cmnd.type) {
            case "add_dur":
                seconds += cmnd.data
                duration = msToTime(seconds)
                break;
            case "add_size":
                bytes += cmnd.data
                memory = formatBytes(bytes)
                break;
            case "rem_dur":
                seconds -= cmnd.data
                if (seconds <= 0) {
                    seconds = 0
                }
                duration = msToTime(seconds)
                break;
            case "rem_size":
                bytes -= cmnd.data
                if (bytes <= 0) {
                    bytes = 0
                }
                memory = formatBytes(bytes)
                break;
            case "add_queue":
                if (!cmnd.data.index || cmnd.data.index == "0") {
                    queue.push(cmnd.data)
                } else {
                    queue.splice(cmnd.data.index,0,cmnd.data)
                }
                
                break;
            case "set_error":
                queue = queue.map(i=>{
                    if (i.id == cmnd.data.id){
                        i = cmnd.data
                        i.progress = "error"
                        i.status = "e"
                    }
                    return i
                })
            break;
            
            case "down_finish":
                queue = queue.map(i=>{
                    if (i.id == cmnd.data.id){
                        i = cmnd.data
                        i.progress = "finish"
                        i.status = "fd"
                    }
                    return i
                })
                break;

            case "concat_finish":
                backup_n = getbdate()
                queue = queue.filter(el=>{
                    for (const f of cmnd.data) {
                        if (f[0] == el.id) {
                            return false
                        }
                    }
                    return true
                })
                qlock = false
                break;

            case "concat":
                let allfin=true,
                list = queue.map(el=>{
                    if (el.status != "fd"){
                        allfin = false
                    }
                    return [el.id,el.name]
                })
                if (!allfin) break;

                const w = new Worker("./concater.js",{
                    workerData:list
                })
                register(w)

            break;
        
        }
    }


    downloaders = downloaders.filter(w=>{
        if (w.threadId<0){
            register(w,true)
            return false
        }
        return true
    })
    
}, interval/2);

setInterval(() => {
    let backup = {
        queue,
        downlcount,
        bytes,
        seconds
    }
    fs.writeFile(
        `./src/backup_${backup_n}.json`,
        JSON.stringify(backup),
        { 
            flag: 'w+' 
        }
    )
    console.log({
        "wc":downloaders.length,
        "cc":commands.length,
        "qc":queue.length
    })
}, interval*4);

/**
 * @param {Worker} worker 
 * @param {boolean} un 
 */
function register(worker,un=false) {
    if (un) {
        worker.terminate()
        worker.removeAllListeners("message")
        return
    }
    worker.on("message",onmessage(worker))
    console.log("id",worker.threadId)
    downloaders.push(worker)
}

function onmessage(worker) {
    return (mess)=>{
        console.log(mess)
        switch (mess.type) {
            case "concat_finish":
            case "down_finish":
                worker.terminate()
                commands.push(mess)
                break;

            default:
                commands.push(mess)
                break;
        
        }
    }
}

function msToTime(s) {
    let seconds = (s).toFixed(1);
    let minutes = (s / (60)).toFixed(1);
    let hours = (s / (60 * 60)).toFixed(1);
    let days = (s / (60 * 60 * 24)).toFixed(1);
    if (seconds < 60) return seconds + " Sec";
    else if (minutes < 60) return minutes + " Min";
    else if (hours < 24) return hours + " Hrs";
    else return days + " Days"
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


server.listen(port)
console.log("Server started on port :%d",port)