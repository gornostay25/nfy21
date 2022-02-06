import Ffmpeg from "fluent-ffmpeg"
import fs from "fs";
import {parentPort,workerData} from "worker_threads"


//https://player02.getcourse.ru/player/306b4e1525cae76e1a1dd57619213c5b/8574365985318e86b436a5f5f56f8fa1/master.m3u8?sid=sid&host=vh-37&user-cdn=cloudflare&v=4%3A2%3A1%3A0&user-id=157471958

//ffmpeg.exe -i "https://player02.getcourse.ru/player/306b4e1525cae76e1a1dd57619213c5b/8574365985318e86b436a5f5f56f8fa1/media/360.m3u8?sid=sid&host=vh-37&user-cdn=cloudflare&v=4%3A2%3A1%3A0&user-id=157471958" -map p:0 -c copy -bsf:a aac_adtstoasc output.mp4

Ffmpeg.setFfmpegPath("./src/ffmpeg/bin/ffmpeg.exe");
Ffmpeg.setFfprobePath("./src/ffmpeg/bin/ffprobe.exe")

/**
 * @type {Ffmpeg.FfmpegCommand}
 */
let proc = new Ffmpeg(),
outputfile = "./src/tmp/"+workerData.id+".mp4"

proc.addInput(workerData.url)

if (workerData.format == "1") {
    proc.addOutputOption(
        "-map p:"+(workerData.playlist ?? "0")
    )
}

proc.outputOptions([
    "-vcodec copy",
    "-acodec copy",
    "-c copy",
    "-bsf:a aac_adtstoasc"
]).output(outputfile)
.on('start', function (commandLine) {
    console.log('Start ' + workerData.name+`(${commandLine})`);
})
.on('error', function (err, stdout, stderr) {
    console.log('An error occurred: ' + err.message, err, stderr);
    fs.writeFileSync("./src/tmp/"+workerData.id+".log",err.message)
    parentPort.postMessage({type:"set_error",data:workerData})
    process.exit(1)
})
.on('progress', function (progress) {
    throttle_log(progress)
})
.on('end', async function (err, stdout, stderr) {
    console.log('Finished processing '+ workerData.name)
    clearTimeout(timeoutHandler)
    timeoutHandler = null
    let dur = await get_duration(outputfile)
    if (!dur) {
        console.error("get duration error")
    }else{
        parentPort.postMessage({type:"add_dur",data:dur})
    }
    let size = fs.statSync(outputfile).size
    parentPort.postMessage({type:"add_size",data:size})

    parentPort.postMessage({type:"down_finish",data:workerData})

})
.run()

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
    console.log(`Processing ${workerData.name}: ` + pp + '% done')
},5000)