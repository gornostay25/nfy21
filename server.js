import fs from "fs/promises";
import http from "http"
import Mustache from "mustache";
import url from "url";

function getPostCallback(url) {
    switch (url) {
        case "/add":
            return POST_add
        case "/workers":
            return POST_changeworkers
        case "/concat":
            return POST_concat
    
        default:
            return (rq,rs,data)=>{rs.statusCode=404;rs.end()};
    }
}
/**
 * @param {http.ClientRequest} req 
 * @param {http.ServerResponse} res 
 */
function POST_add(req,res,data) {
    res.end(server.api({type:"add",data:JSON.parse(data)}))
}

function POST_changeworkers(req,res,data) {
    res.end(server.api({type:"change_workers",data:JSON.parse(data)["count"]}))
}

function POST_concat(req,res,data) {
    res.end(server.api({type:"concat"}))
}

/**
 * @param {http.ClientRequest} req 
 * @param {http.ServerResponse} res 
 */
async function requestListener(req, res) {
    if (req.method == "GET") {
        let path = url.parse(req.url)
        switch (path.pathname) {
            case "/":{
                res.writeHead(200, {'Content-Type': 'text/html'});
                let temp = await fs.readFile("./src/index.html").then(buf=>buf.toString("utf-8")),
                data = server.api({type:"get"})

                let render = Mustache.render(temp,data)
                res.end(render)
                return;
            }
            case "/add":{
                res.writeHead(200, {'Content-Type': 'text/html'});
                let temp = await fs.readFile("./src/addAll.html").then(buf=>buf.toString("utf-8")),
                data = server.api({type:"get"})

                let render = Mustache.render(temp,data)
                res.end(render)
                return;
            }
        }
        res.statusCode = 404
        res.end()
        return;
    }else if (req.method == "POST") {
        /**
         * @type {Function}
         */
        let callback = getPostCallback(req.url),
        data = '';
        req.on('data', chunk => {
            data += chunk;
        })
        req.on('end', () => {
            return callback.call(this,req,res,data)
        })
    }
}

const server = http.createServer(requestListener)
server.api = ()=>{return {}}

export default server

