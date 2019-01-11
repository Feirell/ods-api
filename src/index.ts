import https from 'https'
import iso8859_15 from 'iso-8859-15'

const dafaultParameter = Object.freeze({
    hostname: "ods.fh-dortmund.de",
    headers: Object.freeze({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:64.0) Gecko/20100101 Firefox/64.0'
    })
})

const mergeOptionObjects = (custom, def = dafaultParameter) => {
    const options = { ...def, ...custom };

    if (!options.headers && def.headers)
        options.headers = def.headers

    return options;
}

function makeRequest(origOptions, body = undefined, transformToString = true, replaceRNtoN = true): Promise<{
    statusCode: string,
    responseHeader: string,
    responseBody: string
}> {
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

export interface GradesSummaryEntry {
    /** the id of the entry (exam) */
    id: string,
    /** the displayed name of the exam */
    name: string,
    /** the type e.g. "Summe Leistungspunkte" */
    type: string,
    /** the date or semester on / in which this exam was taken */
    dateSemester: string,
    /** the examiner who held the course / exam */
    examiner: string,
    /** the recieved grade (e.g. "2,3") */
    grade: string,
    /** the European Credit Transfer System credits recieved for this exam  */
    ects: string,
    /** the status of this exam ("PV, Prüfung vorhanden" | "BE, bestanden") */
    status: string,
    /** an optional note attached to this exam */
    note: string
}

export interface GradesEntry {
    /** the id of the entry (exam) */
    id: string,
    /** the displayed name of the exam */
    name: string,
    /** the type e.g. "Modulprüfung" | "Prüfgsleistg in Lehrveran" */
    type: string,
    /** the date or semester on / in which this exam was taken (this will be an date dd.mm.yy for type "Modulprüfung" and YYYYH (H = 1 | 2 which half of the year) for "Prüfgsleistg in Lehrveran") */
    dateSemester: string,
    /** the examiner who held the course / exam ("Secondname, Firstname") */
    examiner: string,
    /** the recieved grade (e.g. "2,3"), this field will be "" if the status is "AN, angemeldet" */
    grade: string,
    /** the European Credit Transfer System credits recieved for this exam, this field will be "" if the status is "AN, angemeldet" */
    ects: string,
    /** the status of this exam ("AN, angemeldet" | "BE, bestanden" | ...) */
    status: string,
    /** an optional note attached to this exam */
    note: string
}

export interface MetaInformation {
    /** the current targeted degree e.g. "84, Bachelor" */
    degree: string,
    /** the current major e.g. "B13, Software- und Systemtechnik (dual)" */
    major: string,
    /** the specialisation of the major */
    areaOfSpecialisation: string,
    /** the year in which the applying regulation was specified */
    examRegulation: string,
    /** the kind of studen e.g. "Haupthörer" */
    status: string,
    /** the title of the student e.g. "Herr" */
    title: string,
    /** the full name of the student */
    fullName: string,
    /** the street (and house number) of the student */
    street: string,
    /** the zip code and the town */
    zipTown: string,
    /** the date the present information was generated (d-m-yy e.g. "25.4.18") */
    dateOfGeneration: string,
    /** the matriculation number */
    matriculationNumber: string,
    /** the date of birt of the student (d-m-yy e.g. "2.10.90") */
    dateOfBirth: string,
    /** the town this student was born in */
    birthTown: string,
    /** the semester this student is currently in */
    semester: string
}

/**
 * This class represents an session on the ods plattform and enables the access to data provided by the website.
 */
export default class ODSConnection {
    /**
     * The currently used session id to authenticate the user on the webpage
     */
    private sessionId: string;

    /**
     * The cache timeout in milliseconds, please the description in the README
     */
    public cacheTimeout: number = 6000000; // 100 minutes cache timeout
    private _cachedGradesPage: {
        time?: number,
        body?: string,
        gradesSummary?: GradesSummaryEntry[],
        grades?: GradesEntry[],
        meta?: MetaInformation
    } = {};

    /**
     * You should not create an instance yourself! Use the login methode instead.
     */
    private constructor(sessionId: string) {
        this.sessionId = sessionId;
    }

    /**
     * Clears the current cache, this will force the next call of one of the three get methodes to pull a new version of the html page.
     */
    public clearCache(): void {
        this._cachedGradesPage = {};
    }

    /**
     * Check wether the item is cached or not.
     */
    private _hasItemInCache(item: string): boolean {
        return item in this._cachedGradesPage;
    }

    /**
     * Gets the html page of the ods overwiev page
     */
    private async _getGradesPage(): Promise<string> {
        const now = Date.now();

        if (!this._hasItemInCache('body') || this._cachedGradesPage.time < (now - this.cacheTimeout)) {
            const { responseBody } = await makeRequest({
                path: '/ods?Sicht=ExcS&ExcSicht=Notenspiegel&m=1&SIDD=' + this.sessionId
            });

            this._cachedGradesPage = {
                body: responseBody,
                time: now
            };
        }

        return this._cachedGradesPage.body;
    }

    /**
     * Gets the grade summary (lower table in the overview)
     */
    public async getGradesSummary(useCache = true): Promise<GradesSummaryEntry[]> {
        if (!useCache)
            this.clearCache();

        if (!this._hasItemInCache('gradesSummary')) {
            const body = await this._getGradesPage();

            const generalMatcher = /<table.*?<table.*?<table.*?<table.*?<table.*?<\/tr>(.*?)<\/table>/s;
            const generalMatch = generalMatcher.exec(body);

            if (generalMatch == null)
                throw new Error('could not find the secion');

            const tableRowMatcher = /<td>(.*?)<\/td>.+?<td>(.*?)  <\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?) &nbsp;<\/td>.+?<td align="right">(.*?)<\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?) &nbsp;<\/td>/gs;

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
                };
            }

            this._cachedGradesPage.gradesSummary = matchObjects;
        }

        return [...this._cachedGradesPage.gradesSummary].map(v => ({ ...v }));
    }

    /**
     * Gets the Meta information available in the ods system
     */
    public async getMetaInformation(useCache = true): Promise<MetaInformation> {
        if (!useCache)
            this.clearCache();

        if (!this._hasItemInCache('meta')) {
            const body = await this._getGradesPage();

            const meta = <MetaInformation>{};

            {
                const generalMatcher = /<table.*?<table.*?<table.*?<\/tr>(.*?)<\/table>/s;
                const generalMatch = generalMatcher.exec(body);

                if (generalMatch == null)
                    throw new Error('could not find the secion');

                const tableRowMatcher = /<\/td>.*?<td>(.*?)<\/td>.*?<\/td>.*?<td>(.*?)<\/td>.*?<\/td>.*?<td>(.*?)<\/td>.*?<\/td>.*?<td>(.*?)<\/td>.*?<\/td>.*?<td>(?:\n                )?(.*?)<\/td>.*?<\/td>.*?<td>(.*?)<\/td>/s;
                const tableRowMatch = tableRowMatcher.exec(generalMatch[1]);

                if (tableRowMatch == null)
                    throw new Error('could not find the meta information');

                meta.degree = tableRowMatch[1];
                meta.major = tableRowMatch[2];
                meta.areaOfSpecialisation = tableRowMatch[3];
                meta.examRegulation = tableRowMatch[4];
                meta.status = tableRowMatch[5];
                // meta.semester = tableRowMatch[6]; // will be setted by the next block
            }

            {
                const generalMatcher = /<div style="text-align:left;float:left;">(.*)<div  style="margin-top: 120px;">&nbsp;<\/div>/s;
                const generalMatch = generalMatcher.exec(body);

                if (generalMatch == null)
                    throw new Error('could not find the secion');

                const tableRowMatcher = /<b>(.*?)<\/b>.+?<b>(.*?)<\/b>.+?<b>(.*?)<\/b>.+?<b>(.*?)<\/b>.*?class="norm".*?<\/td>.*?<td>(.*?)<\/td>.*?<\/td>.*?<td>(.*?)<\/td>.*?<\/td>.*?<td>(.*?)<\/td>.*?<\/td>.*?<td>(.*?)<\/td>.*?<\/td>.*?<td>(.*?)<\/td>/s;
                const tableRowMatch = tableRowMatcher.exec(generalMatch[1]);

                if (tableRowMatch == null)
                    throw new Error('could not find the meta information');

                meta.title = tableRowMatch[1];
                meta.fullName = tableRowMatch[2];
                meta.street = tableRowMatch[3];
                meta.zipTown = tableRowMatch[4];
                meta.dateOfGeneration = tableRowMatch[5];
                meta.matriculationNumber = tableRowMatch[6];
                meta.dateOfBirth = tableRowMatch[7];
                meta.birthTown = tableRowMatch[8];
                meta.semester = tableRowMatch[9];
            }

            this._cachedGradesPage.meta = meta;
        }

        return { ...this._cachedGradesPage.meta };
    }

    /**
     * Gets the grades (upper table in the overview)
     */
    public async getGrades(useCache = true): Promise<GradesEntry[]> {
        if (!useCache)
            this.clearCache();

        if (!this._hasItemInCache('grades')) {
            const body = await this._getGradesPage();

            const generalMatcher = /Vermerk:<\/td>.+?<\/tr>(.+?)<\/table>/s;
            const tableRowMatcher = /<td>(.*?)<\/td>.+?<td>(.*?)  <\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?) &nbsp;<\/td>.+?<td align="right">(.*?)<\/td>.+?<td>(.*?)<\/td>.+?<td>(.*?) &nbsp;<\/td>/gs;

            const generalMatch = generalMatcher.exec(body);

            if (generalMatch == null)
                throw new Error('could not find the secion');

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
                };
            }

            this._cachedGradesPage.grades = matchObjects;
        }

        // copying the data to enable the user to manipulate it even if we cache it
        return [...this._cachedGradesPage.grades].map(v => ({ ...v }));
    }

    /**
     * Gets own endpoint (public ip adress of the current used network)
     */
    private static async _getOwnEndpoint(): Promise<string> {
        const matcher = /<input type=hidden name="RemoteEndPointIP" value="(.+?)">/;

        const { responseBody } = await makeRequest({
            path: '/ods'
        });
        const res = matcher.exec(responseBody);

        return !res ? null : res[1];
    }

    /**
     * Tries to login into the ods system with the given credentials. If the login succedes an ODSConnection instance will be returned, null otherwise.
     */
    public static async login(username: string, password: string): Promise<null | ODSConnection> {

        const remoteIP = await this._getOwnEndpoint();
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