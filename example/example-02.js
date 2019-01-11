const { ODSConnection } = require('ods-api');

ODSConnection.login('username', 'password')
    .then(conn => {
        if (conn == null)
            throw new Error('either username and / or password was wrong or the the ods service was not reachable');
        else
            return Promise.all([
                conn.getMetaInformation(),
                conn.getGradesSummary(),
                conn.getGrades()

            ]);
    })
    .then(([metaInformation, gradesSummy, grades]) => {
        require('fs').writeFileSync(metaInformation.matriculationNumber + '.json', JSON.stringify({ metaInformation, gradesSummy, grades }, undefined, 4))
    })
    .catch(console.error);