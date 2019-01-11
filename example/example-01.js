const ODSConnection = require('ods-api');

(async () => {
    const conn = await ODSConnection.login('username', 'password');

    if (conn == null)
        throw new Error('either username and / or password was wrong or the the ods service was not reachable');

    const metaInformation = await conn.getMetaInformation();
    const gradesSummy = await conn.getGradesSummary();
    const grades = await conn.getGrades();

    require('fs').writeFileSync(metaInformation.matriculationNumber + '.json', JSON.stringify({ metaInformation, gradesSummy, grades }, undefined, 4));
})()
    .catch(console.error);