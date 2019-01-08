const https = require('https');
const iso8859_15 = require('iso-8859-15');

const dafaultParameter = Object.freeze({
    hostname: "ods.fh-dortmund.de",
    headers: Object.freeze({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:64.0) Gecko/20100101 Firefox/64.0'
    })
})

const mergeOptionObjects = (custom, def = dafaultParameter) => {
    const options = { ...def, ...custom };

    if (!options.headers && def.headers)
        options = def.headers

    return options;
}

function makeRequest(origOptions, body, transformToString = true, replaceRNtoN = true) {
    const options = mergeOptionObjects(origOptions, dafaultParameter);

    return new Promise((res, rej) => {
        const req = https.request(options);
        req.on('response', response => {

            const contentType = response.headers['content-type'];
            const isText = contentType.startsWith('text/');

            let chunks = [];

            response.on('data', chunk => {
                chunks[chunks.length] = chunk;

            });

            response.on('end', () => {
                const chuncBuffer = Buffer.concat(chunks);
                let data;

                if (isText && transformToString) {
                    let stringRepresentation = chuncBuffer.toString('utf8');

                    if (stringRepresentation.indexOf('<meta http-equiv="Content-type" content="text/html; charset=ISO-8859-15">') != -1)
                        stringRepresentation = iso8859_15.decode(chuncBuffer.toString('binary'));

                    if (replaceRNtoN)
                        stringRepresentation = stringRepresentation.replace(/\r\n/g, '\n');

                    data = stringRepresentation;
                } else
                    data = chuncBuffer;

                res({
                    statusCode: response.statusCode,
                    responseHeader: response.headers,
                    responseBody: data
                });
            })
        });

        req.on('error', err => {
            rej(err);
        });

        req.end(typeof body == "string" || body instanceof Buffer ? body : undefined);
    });
}

class ODSConnection {
    constructor(sessionId) {
        this.sessionId = sessionId;
        // this.cacheTimeout = 6000000; // 100 minutes cache timeout
        this.cacheTimeout = 20000;
        this._cachedGradesPage = null;
    }

    async getGradesPage(useCache) {
        const now = Date.now();
        if (!useCache || !this._cachedGradesPage || this._cachedGradesPage.time < (now - this.cacheTimeout)) {
            const { responseBody } = await makeRequest({
                path: '/ods?Sicht=ExcS&ExcSicht=Notenspiegel&m=1&SIDD=' + this.sessionId
            });

            this._cachedGradesPage = Object.freeze({
                body: responseBody,
                time: now
            });
        }

        return this._cachedGradesPage.body;
    }

    async getGrades(useCache = true) {
        const body = await this.getGradesPage(useCache);

        const generalMatcher = /Vermerk:<\/td>.+?<\/tr>(.+?)<\/table>/s;
        const tableRowMatcher = /<td>(.*?)<\/td>.+?<td>(.*?)  <\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?) &nbsp;<\/td>.+?<td align="right">(.*?)<\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?) &nbsp;<\/td>/gs;

        const generalMatch = generalMatcher.exec(body);

        if (generalMatch == null)
            throw new Error('could not load the table');

        let matchObjects = [];
        let match;

        while ((match = tableRowMatcher.exec(generalMatch[1])) != null) {
            matchObjects[matchObjects.length] = {
                id: match[1],
                name: match[2],
                type: match[3],
                dateSemester: match[4],
                examiner: match[5],
                grade: match[6],
                ects: match[7],
                status: match[8],
                note: match[9]
            }
        }

        return matchObjects;
    }

    static async getOwnEndpoint() {
        const matcher = /<input type=hidden name="RemoteEndPointIP" value="(.+?)">/;

        const { responseBody } = await makeRequest({
            path: '/ods'
        });
        const res = matcher.exec(responseBody);

        return !res ? null : res[1];
    }

    static async login(username, password) {

        const remoteIP = await this.getOwnEndpoint();
        const postBody = 'LIMod=&HttpRequest_PathFile=%2F&HttpRequest_Path=%2F&RemoteEndPointIP=' + remoteIP + '&User=' + encodeURIComponent(username) + '&PWD=' + encodeURIComponent(password) + '&x=0&y=0'

        // some id like this 0x04FA76B1857DC2489FFD5520A82D349D

        const matcher = /"https:\/\/dias\.fh-dortmund\.de\/ods\?Sicht=Menue&SIDD=(.+?)"/;

        const { responseBody } = await makeRequest({
            method: 'POST',
            path: '/ods',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }, postBody);

        const res = matcher.exec(responseBody);
        const session = !res ? null : res[1];

        if (session) {
            return new ODSConnection(session);
        } else {
            return null;
        }
    }
}

module.exports = ODSConnection;