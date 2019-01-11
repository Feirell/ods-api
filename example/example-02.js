const ODSConnection = require('ods-api');

ODSConnection.login('username', 'password')
    .then(conn => conn == null ? null : Promise.all([
        conn.getMetaInformation(),
        conn.getGradesSummary(),
        conn.getGrades()
    ]))
    .then(([metaInformation, gradesSummy, grades]) => {
        require('fs').writeFileSync(metaInformation.matriculationNumber + '.json', JSON.stringify({ metaInformation, gradesSummy, grades }, undefined, 4))
    }, console.error);