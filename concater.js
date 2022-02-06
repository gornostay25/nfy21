import Ffmpeg from "fluent-ffmpeg"
import fs from "fs";
import {parentPort,workerData} from "worker_threads"


//https://player02.getcourse.ru/player/306b4e1525cae76e1a1dd57619213c5b/8574365985318e86b436a5f5f56f8fa1/master.m3u8?sid=sid&host=vh-37&user-cdn=cloudflare&v=4%3A2%3A1%3A0&user-id=157471958

//ffmpeg.exe -i "https://player02.getcourse.ru/player/306b4e1525cae76e1a1dd57619213c5b/8574365985318e86b436a5f5f56f8fa1/media/360.m3u8?sid=sid&host=vh-37&user-cdn=cloudflare&v=4%3A2%3A1%3A0&user-id=157471958" -map p:0 -c copy -bsf:a aac_adtstoasc output.mp4

Ffmpeg.setFfmpegPath("./src/ffmpeg/bin/ffmpeg.exe");
Ffmpeg.setFfprobePath("./src/ffmpeg/bin/ffprobe.exe")

let description = "",
sizez = 0,
time = 0


async function main() {
    let qData = workerData.filter(vid=>{
        let size = fs.statSync("./src/tmp/"+vid[0]+".mp4").size
        if ((sizez+size) < 137300000000){
            sizez+=size
            return true
        }
        return false
    }) 
    /**
     * @type {Ffmpeg.FfmpegCommand}
    */
    let proc = new Ffmpeg(),
    outputfile = "./src/tmp/output.mp4";

    for (let i = 0; i < qData.length; i++) {
        const element = qData[i],
        prevelement = qData[i-1]
        if (i == 0){
            description+="00:00:00 "+element[1]+"\n"
            outputfile = "./src/tmp/output_"+element[0]+".mp4";
            continue
        }
        let dur = await get_duration("./src/tmp/"+prevelement[0]+".mp4")
        if (dur+time > 41400){
            delete qData[i]
            continue
        }
        time+=dur
        description += toHHMMSS(time)+" "+element[1]+"\n"
    }
    let listxt = ""
    for (const li of qData) {
        listxt += "file '"+li[0]+".mp4'\n"
    }
    fs.writeFileSync("./src/tmp/list.txt",listxt.trimEnd())
    proc.input("./src/tmp/list.txt")
    .inputOptions([
        '-f concat', 
        '-safe 0'
    ])
    .outputOptions('-c copy')
    .output(outputfile)
    .on('start', function (commandLine) {
        console.log('Start concating'+`(${commandLine})`);
    })
    .on('error', function (err, stdout, stderr) {
        console.log('An error occurred: ' + err.message, err, stderr);
        process.exit(1)
    })
    .on('progress', function (progress) {
        throttle_log(progress)
    })
    .on('end', async function (err, stdout, stderr) {

        fs.writeFileSync("./src/tmp/desc.txt",description)
        console.log('Finished process concat')
        clearTimeout(timeoutHandler)
        timeoutHandler = null

        parentPort.postMessage({type:"rem_dur",data:time})
        
        parentPort.postMessage({type:"rem_size",data:sizez})
    
        let todel = []
        for (const d of qData) {
            todel.push(
                unlink_promise("./src/tmp/"+d[0]+".mp4")
            ) 
        }
        await Promise.all(todel)
        parentPort.postMessage({type:"concat_finish",data:qData})
    
    })
    .run()


}

function unlink_promise(src) {
    return new Promise((rs,rj)=>{
        fs.unlink(src,(err)=>{
            if (err){
                console.log("Error cant delete "+src)
                rj()
            }
            rs()
        })
    })
}

function toHHMMSS (time) {
    var sec_num = parseInt(time, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours + ':' + minutes + ':' + seconds;
}
function get_duration(src) {
    return new Promise((rs,rj)=>{
        let tout = setTimeout(() => {
            rj(0)
        }, 10000);
        Ffmpeg.ffprobe(src,(e,m)=>{
            if (e) {
                console.error(e)
                rj(0)
            }
            clearTimeout(tout)
            rs(m.streams[0].duration)
        })
    })
}


let timeoutHandler = null;
function throttle(callback, delay) {
    return function (...args) {
        if (timeoutHandler == null) {
            timeoutHandler = setTimeout(function () {
                callback.call(this,...args)
                timeoutHandler = null;
            }, delay);
        }
    }
}
let throttle_log = throttle((progress={})=>{
    let pp = "0"
    if (progress.percent){
        pp = +Math.round(progress.percent)
    }
    console.log(`Processing concat: ` + pp + '% done')
},5000)

main()